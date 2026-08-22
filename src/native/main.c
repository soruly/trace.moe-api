#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <unistd.h>
#include <pthread.h>

#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
#include <zstd.h>

#include "color_layout.h"

#ifdef _WIN32
#include <io.h>
#include <fcntl.h>
#define SET_BINARY_MODE() _setmode(_fileno(stdout), _O_BINARY)
#else
#define SET_BINARY_MODE() ((void)0)
#endif

#define QUEUE_CAPACITY 128
#define BLOCK_SIZE 8192
#define INITIAL_BLOCKS 64
#define MAX_BLOCKS 4096

typedef struct {
    double time;
    uint8_t vector[COLOR_LAYOUT_VECTOR_SIZE];
} FrameResult;

typedef struct {
    FrameResult *blocks[MAX_BLOCKS];
    size_t num_blocks;
    pthread_mutex_t alloc_mutex;
} ResultTable;

static void result_table_init(ResultTable *t) {
    memset(t->blocks, 0, sizeof(t->blocks));
    pthread_mutex_init(&t->alloc_mutex, NULL);
    t->num_blocks = INITIAL_BLOCKS;
    for (size_t i = 0; i < INITIAL_BLOCKS; i++) {
        t->blocks[i] = (FrameResult *)calloc(BLOCK_SIZE, sizeof(FrameResult));
    }
}

static void result_table_ensure_index(ResultTable *t, size_t index) {
    size_t block_idx = index / BLOCK_SIZE;
    if (block_idx >= MAX_BLOCKS) return;

    if (!t->blocks[block_idx]) {
        pthread_mutex_lock(&t->alloc_mutex);
        if (!t->blocks[block_idx]) {
            t->blocks[block_idx] = (FrameResult *)calloc(BLOCK_SIZE, sizeof(FrameResult));
            if (block_idx >= t->num_blocks) {
                t->num_blocks = block_idx + 1;
            }
        }
        pthread_mutex_unlock(&t->alloc_mutex);
    }
}

static inline FrameResult *result_table_get(ResultTable *t, size_t index) {
    size_t block_idx = index / BLOCK_SIZE;
    size_t offset = index % BLOCK_SIZE;
    if (block_idx >= MAX_BLOCKS || !t->blocks[block_idx]) return NULL;
    return &t->blocks[block_idx][offset];
}

static void result_table_free(ResultTable *t) {
    for (size_t i = 0; i < MAX_BLOCKS; i++) {
        if (t->blocks[i]) {
            free(t->blocks[i]);
            t->blocks[i] = NULL;
        }
    }
    pthread_mutex_destroy(&t->alloc_mutex);
}

typedef struct {
    AVFrame *frame;
    double pts_time;
    size_t index;
} WorkItem;

typedef struct {
    WorkItem items[QUEUE_CAPACITY];
    size_t head;
    size_t tail;
    size_t count;
    bool finished;
    pthread_mutex_t mutex;
    pthread_cond_t not_empty;
    pthread_cond_t not_full;
} WorkQueue;

static void queue_init(WorkQueue *q) {
    q->head = 0;
    q->tail = 0;
    q->count = 0;
    q->finished = false;
    pthread_mutex_init(&q->mutex, NULL);
    pthread_cond_init(&q->not_empty, NULL);
    pthread_cond_init(&q->not_full, NULL);
}

static void queue_push(WorkQueue *q, AVFrame *frame, double pts_time, size_t index) {
    pthread_mutex_lock(&q->mutex);
    while (q->count == QUEUE_CAPACITY) {
        pthread_cond_wait(&q->not_full, &q->mutex);
    }
    q->items[q->tail].frame = frame;
    q->items[q->tail].pts_time = pts_time;
    q->items[q->tail].index = index;
    q->tail = (q->tail + 1) % QUEUE_CAPACITY;
    q->count++;
    pthread_cond_signal(&q->not_empty);
    pthread_mutex_unlock(&q->mutex);
}

static bool queue_pop(WorkQueue *q, WorkItem *out_item) {
    pthread_mutex_lock(&q->mutex);
    while (q->count == 0 && !q->finished) {
        pthread_cond_wait(&q->not_empty, &q->mutex);
    }
    if (q->count == 0 && q->finished) {
        pthread_mutex_unlock(&q->mutex);
        return false;
    }
    *out_item = q->items[q->head];
    q->head = (q->head + 1) % QUEUE_CAPACITY;
    q->count--;
    pthread_cond_signal(&q->not_full);
    pthread_mutex_unlock(&q->mutex);
    return true;
}

static void queue_set_finished(WorkQueue *q) {
    pthread_mutex_lock(&q->mutex);
    q->finished = true;
    pthread_cond_broadcast(&q->not_empty);
    pthread_mutex_unlock(&q->mutex);
}

static void queue_destroy(WorkQueue *q) {
    pthread_mutex_destroy(&q->mutex);
    pthread_cond_destroy(&q->not_empty);
    pthread_cond_destroy(&q->not_full);
}

typedef struct {
    WorkQueue *queue;
    ResultTable *results;
} WorkerContext;

static void *worker_thread_fn(void *arg) {
    WorkerContext *ctx = (WorkerContext *)arg;

    struct SwsContext *sws_ctx = NULL;
    int last_width = 0, last_height = 0;
    enum AVPixelFormat last_fmt = AV_PIX_FMT_NONE;

    AVFrame *rgb_frame = av_frame_alloc();
    av_image_alloc(rgb_frame->data, rgb_frame->linesize,
                   COLOR_LAYOUT_WIDTH, COLOR_LAYOUT_HEIGHT, AV_PIX_FMT_RGB24, 32);

    WorkItem item;
    while (queue_pop(ctx->queue, &item)) {
        AVFrame *src_frame = item.frame;

        if (src_frame && src_frame->data[0] && src_frame->width > 0 && src_frame->height > 0) {
            if (!sws_ctx || src_frame->width != last_width || src_frame->height != last_height || src_frame->format != (int)last_fmt) {
                if (sws_ctx) sws_freeContext(sws_ctx);
                last_width = src_frame->width;
                last_height = src_frame->height;
                last_fmt = (enum AVPixelFormat)src_frame->format;

                sws_ctx = sws_getContext(
                    last_width, last_height, last_fmt,
                    COLOR_LAYOUT_WIDTH, COLOR_LAYOUT_HEIGHT, AV_PIX_FMT_RGB24,
                    SWS_BICUBIC | SWS_ACCURATE_RND, NULL, NULL, NULL
                );

                if (sws_ctx) {
                    int *inv_table, *table;
                    int srcRange, dstRange, brightness, contrast, saturation;
                    if (sws_getColorspaceDetails(sws_ctx, &inv_table, &srcRange, &table, &dstRange, &brightness, &contrast, &saturation) >= 0) {
                        int cs = (src_frame->colorspace != AVCOL_SPC_UNSPECIFIED) ? src_frame->colorspace : SWS_CS_DEFAULT;
                        const int *src_coeff = sws_getCoefficients(cs);
                        int src_range = (src_frame->color_range == AVCOL_RANGE_JPEG) ? 1 : 0;
                        sws_setColorspaceDetails(sws_ctx, src_coeff, src_range, table, dstRange, brightness, contrast, saturation);
                    }
                }
            }

            if (sws_ctx) {
                sws_scale(sws_ctx, (const uint8_t *const *)src_frame->data, src_frame->linesize,
                          0, src_frame->height, rgb_frame->data, rgb_frame->linesize);

                FrameResult *res = result_table_get(ctx->results, item.index);
                if (res) {
                    res->time = item.pts_time;
                    extract_color_layout(rgb_frame->data[0], COLOR_LAYOUT_WIDTH, COLOR_LAYOUT_HEIGHT, res->vector);
                }
            }
        }

        if (src_frame) {
            av_frame_free(&src_frame);
        }
    }

    av_freep(&rgb_frame->data[0]);
    av_frame_free(&rgb_frame);
    if (sws_ctx) sws_freeContext(sws_ctx);

    return NULL;
}

// Fast integer to string helper for numbers 0..255
static inline char *write_u8(char *p, uint8_t val) {
    if (val >= 100) {
        *p++ = (char)('0' + (val / 100));
        val %= 100;
        *p++ = (char)('0' + (val / 10));
        *p++ = (char)('0' + (val % 10));
    } else if (val >= 10) {
        *p++ = (char)('0' + (val / 10));
        *p++ = (char)('0' + (val % 10));
    } else {
        *p++ = (char)('0' + val);
    }
    return p;
}

static char *serialize_results_to_json(ResultTable *t, size_t count, size_t *out_len) {
    size_t max_size = count * 256 + 4096;
    char *buf = (char *)malloc(max_size);
    if (!buf) return NULL;

    char *p = buf;
    *p++ = '[';

    for (size_t i = 0; i < count; i++) {
        FrameResult *res = result_table_get(t, i);
        if (!res) continue;

        if (i > 0) *p++ = ',';

        memcpy(p, "{\"time\":", 8);
        p += 8;

        int written = snprintf(p, 32, "%.6f", res->time);
        if (written > 0) p += written;

        memcpy(p, ",\"vector\":[", 11);
        p += 11;

        for (int v = 0; v < COLOR_LAYOUT_VECTOR_SIZE; v++) {
            if (v > 0) *p++ = ',';
            p = write_u8(p, res->vector[v]);
        }

        *p++ = ']';
        *p++ = '}';
    }

    *p++ = ']';
    *p = '\0';

    *out_len = (size_t)(p - buf);
    return buf;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <input_file>\n", argv[0]);
        return 1;
    }

    const char *input_file = argv[1];

    av_log_set_level(AV_LOG_ERROR);

    AVFormatContext *fmt_ctx = NULL;
    if (avformat_open_input(&fmt_ctx, input_file, NULL, NULL) < 0) {
        fprintf(stderr, "[color-layout-native][error] Could not open input file: %s\n", input_file);
        return 1;
    }

    if (avformat_find_stream_info(fmt_ctx, NULL) < 0) {
        fprintf(stderr, "[color-layout-native][error] Could not find stream information: %s\n", input_file);
        avformat_close_input(&fmt_ctx);
        return 1;
    }

    int video_stream_idx = av_find_best_stream(fmt_ctx, AVMEDIA_TYPE_VIDEO, -1, -1, NULL, 0);
    if (video_stream_idx < 0) {
        fprintf(stderr, "[color-layout-native][error] No video stream found in %s\n", input_file);
        avformat_close_input(&fmt_ctx);
        return 1;
    }

    AVStream *video_stream = fmt_ctx->streams[video_stream_idx];
    const AVCodec *codec = avcodec_find_decoder(video_stream->codecpar->codec_id);
    if (!codec) {
        fprintf(stderr, "[color-layout-native][error] Decoder not found for codec ID %d\n", video_stream->codecpar->codec_id);
        avformat_close_input(&fmt_ctx);
        return 1;
    }

    AVCodecContext *codec_ctx = avcodec_alloc_context3(codec);
    if (!codec_ctx) {
        fprintf(stderr, "[color-layout-native][error] Failed to allocate codec context\n");
        avformat_close_input(&fmt_ctx);
        return 1;
    }

    if (avcodec_parameters_to_context(codec_ctx, video_stream->codecpar) < 0) {
        fprintf(stderr, "[color-layout-native][error] Failed to copy codec parameters to context\n");
        avcodec_free_context(&codec_ctx);
        avformat_close_input(&fmt_ctx);
        return 1;
    }

    codec_ctx->thread_type = FF_THREAD_FRAME | FF_THREAD_SLICE;
    codec_ctx->thread_count = 0;

    if (avcodec_open2(codec_ctx, codec, NULL) < 0) {
        fprintf(stderr, "[color-layout-native][error] Failed to open codec\n");
        avcodec_free_context(&codec_ctx);
        avformat_close_input(&fmt_ctx);
        return 1;
    }

    long num_cpus = sysconf(_SC_NPROCESSORS_ONLN);
    int num_workers = (num_cpus > 1) ? (int)(num_cpus > 16 ? 16 : num_cpus) : 2;

    ResultTable result_table;
    result_table_init(&result_table);

    WorkQueue queue;
    queue_init(&queue);

    WorkerContext worker_ctx = {
        .queue = &queue,
        .results = &result_table,
    };

    pthread_t *threads = (pthread_t *)malloc(num_workers * sizeof(pthread_t));
    for (int i = 0; i < num_workers; i++) {
        pthread_create(&threads[i], NULL, worker_thread_fn, &worker_ctx);
    }

    AVPacket *pkt = av_packet_alloc();
    AVFrame *frame = av_frame_alloc();
    size_t total_frames = 0;

    while (av_read_frame(fmt_ctx, pkt) >= 0) {
        if (pkt->stream_index == video_stream_idx) {
            if (avcodec_send_packet(codec_ctx, pkt) >= 0) {
                while (avcodec_receive_frame(codec_ctx, frame) >= 0) {
                    int64_t pts = frame->best_effort_timestamp;
                    if (pts == AV_NOPTS_VALUE) pts = frame->pts;
                    double pts_time = (pts != AV_NOPTS_VALUE) ? (double)pts * av_q2d(video_stream->time_base) : 0.0;

                    result_table_ensure_index(&result_table, total_frames);

                    AVFrame *work_frame = av_frame_alloc();
                    av_frame_move_ref(work_frame, frame);

                    queue_push(&queue, work_frame, pts_time, total_frames);
                    total_frames++;
                }
            }
        }
        av_packet_unref(pkt);
    }

    // Flush decoder
    avcodec_send_packet(codec_ctx, NULL);
    while (avcodec_receive_frame(codec_ctx, frame) >= 0) {
        int64_t pts = frame->best_effort_timestamp;
        if (pts == AV_NOPTS_VALUE) pts = frame->pts;
        double pts_time = (pts != AV_NOPTS_VALUE) ? (double)pts * av_q2d(video_stream->time_base) : 0.0;

        result_table_ensure_index(&result_table, total_frames);

        AVFrame *work_frame = av_frame_alloc();
        av_frame_move_ref(work_frame, frame);

        queue_push(&queue, work_frame, pts_time, total_frames);
        total_frames++;
    }

    // Signal workers that all frames have been dispatched
    queue_set_finished(&queue);

    // Wait for all worker threads to complete
    for (int i = 0; i < num_workers; i++) {
        pthread_join(threads[i], NULL);
    }

    free(threads);
    queue_destroy(&queue);
    av_frame_free(&frame);
    av_packet_free(&pkt);
    avcodec_free_context(&codec_ctx);
    avformat_close_input(&fmt_ctx);

    // Serialize JSON
    size_t json_len = 0;
    char *json_str = serialize_results_to_json(&result_table, total_frames, &json_len);

    // Compress with zstd level 19
    size_t const zstd_bound = ZSTD_compressBound(json_len);
    void *zstd_buf = malloc(zstd_bound);
    if (!zstd_buf) {
        fprintf(stderr, "[color-layout-native][error] Failed to allocate zstd buffer\n");
        free(json_str);
        result_table_free(&result_table);
        return 1;
    }

    size_t const zstd_size = ZSTD_compress(zstd_buf, zstd_bound, json_str, json_len, 19);
    if (ZSTD_isError(zstd_size)) {
        fprintf(stderr, "[color-layout-native][error] zstd compression failed: %s\n", ZSTD_getErrorName(zstd_size));
        free(zstd_buf);
        free(json_str);
        result_table_free(&result_table);
        return 1;
    }

    // Output binary zstd payload to stdout
    SET_BINARY_MODE();
    fwrite(zstd_buf, 1, zstd_size, stdout);
    fflush(stdout);

    // Report frame count to stderr for caller
    fprintf(stderr, "[color-layout-native][done] frames: %zu, raw_json: %zu bytes, zstd: %zu bytes\n", 
            total_frames, json_len, zstd_size);

    free(zstd_buf);
    free(json_str);
    result_table_free(&result_table);

    return 0;
}
