#include "color_layout.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

static const float COSINE_ARRAY[8][8] = {
    {3.535534e-1f,  3.535534e-1f,  3.535534e-1f,  3.535534e-1f,  3.535534e-1f,  3.535534e-1f,  3.535534e-1f,  3.535534e-1f},
    {4.903926e-1f,  4.157348e-1f,  2.777851e-1f,  9.754516e-2f, -9.754516e-2f, -2.777851e-1f, -4.157348e-1f, -4.903926e-1f},
    {4.619398e-1f,  1.913417e-1f, -1.913417e-1f, -4.619398e-1f, -4.619398e-1f, -1.913417e-1f,  1.913417e-1f,  4.619398e-1f},
    {4.157348e-1f, -9.754516e-2f, -4.903926e-1f, -2.777851e-1f,  2.777851e-1f,  4.903926e-1f,  9.754516e-2f, -4.157348e-1f},
    {3.535534e-1f, -3.535534e-1f, -3.535534e-1f,  3.535534e-1f,  3.535534e-1f, -3.535534e-1f, -3.535534e-1f,  3.535534e-1f},
    {2.777851e-1f, -4.903926e-1f,  9.754516e-2f,  4.157348e-1f, -4.157348e-1f, -9.754516e-2f,  4.903926e-1f, -2.777851e-1f},
    {1.913417e-1f, -4.619398e-1f,  4.619398e-1f, -1.913417e-1f, -1.913417e-1f,  4.619398e-1f, -4.619398e-1f,  1.913417e-1f},
    {9.754516e-2f, -2.777851e-1f,  4.157348e-1f, -4.903926e-1f,  4.903926e-1f, -4.157348e-1f,  2.777851e-1f, -9.754516e-2f},
};

static const uint8_t ZIG_ZAG_ARRAY[64] = {
     0,  1,  8, 16,  9,  2,  3, 10,
    17, 24, 32, 25, 18, 11,  4,  5,
    12, 19, 26, 33, 40, 48, 41, 34,
    27, 20, 13,  6,  7, 14, 21, 28,
    35, 42, 49, 56, 57, 50, 43, 36,
    29, 22, 15, 23, 30, 37, 44, 51,
    58, 59, 52, 45, 38, 31, 39, 46,
    53, 60, 61, 54, 47, 55, 62, 63
};

static void Fdct(int16_t shapes[64]) {
    float dct_buffer[64];
    float s;

    for (int i = 0; i < 8; i++) {
        for (int j = 0; j < 8; j++) {
            s = 0.0f;
            for (int k = 0; k < 8; k++) {
                s += COSINE_ARRAY[j][k] * (float)shapes[8 * i + k];
            }
            dct_buffer[8 * i + j] = s;
        }
    }

    for (int j = 0; j < 8; j++) {
        for (int i = 0; i < 8; i++) {
            s = 0.0f;
            for (int k = 0; k < 8; k++) {
                s += COSINE_ARRAY[i][k] * dct_buffer[8 * k + j];
            }
            shapes[8 * i + j] = (int16_t)floorf(s + 0.499999f);
        }
    }
}

static inline uint8_t quant_ydc(int i) {
    if (i > 192) return (uint8_t)(112 + ((i - 192) >> 2));
    else if (i > 160) return (uint8_t)(96 + ((i - 160) >> 1));
    else if (i > 96) return (uint8_t)(32 + (i - 96));
    else if (i > 64) return (uint8_t)(16 + ((i - 64) >> 1));
    return (uint8_t)(i >> 2);
}

static inline uint8_t quant_cdc(int i) {
    if (i > 191) return 63;
    else if (i > 160) return (uint8_t)(56 + ((i - 160) >> 2));
    else if (i > 144) return (uint8_t)(48 + ((i - 144) >> 1));
    else if (i > 112) return (uint8_t)(16 + (i - 112));
    else if (i > 96) return (uint8_t)(8 + ((i - 96) >> 1));
    else if (i > 64) return (uint8_t)((i - 64) >> 2);
    return 0;
}

static inline uint8_t quant_ac(int i) {
    int j;
    if (i < -256) i = -256;
    if (i > 255) i = 255;

    int abs_i = abs(i);
    if (abs_i > 127) j = 64 + (abs_i >> 2);
    else if (abs_i > 63) j = 32 + (abs_i >> 1);
    else j = abs_i;

    if (i < 0) j = -j;
    return (uint8_t)(j + 128);
}

void extract_color_layout(const uint8_t *rgb_data, int width, int height, uint8_t out_vector[COLOR_LAYOUT_VECTOR_SIZE]) {
    float sumR[64] = {0};
    float sumG[64] = {0};
    float sumB[64] = {0};

    uint32_t x_start[9];
    uint32_t y_start[9];

    for (int i = 0; i <= 8; i++) {
        x_start[i] = (uint32_t)ceilf((float)(i * width) / 8.0f);
        y_start[i] = (uint32_t)ceilf((float)(i * height) / 8.0f);
    }

    size_t ptr = 0;

    for (int by = 0; by < 8; by++) {
        uint32_t y_end = y_start[by + 1];

        for (uint32_t y = y_start[by]; y < y_end; y++) {
            for (int bx = 0; bx < 8; bx++) {
                uint32_t x_end = x_start[bx + 1];
                int k_idx = (by << 3) + bx;

                float sR = sumR[k_idx];
                float sG = sumG[k_idx];
                float sB = sumB[k_idx];

                for (uint32_t x = x_start[bx]; x < x_end; x++) {
                    sR += (float)rgb_data[ptr++];
                    sG += (float)rgb_data[ptr++];
                    sB += (float)rgb_data[ptr++];
                }
                sumR[k_idx] = sR;
                sumG[k_idx] = sG;
                sumB[k_idx] = sB;
            }
        }
    }

    int16_t shape[3][64];

    for (int by = 0; by < 8; by++) {
        uint32_t h = y_start[by + 1] - y_start[by];
        for (int bx = 0; bx < 8; bx++) {
            uint32_t w = x_start[bx + 1] - x_start[bx];
            uint32_t count = w * h;
            int k_idx = (by << 3) + bx;

            if (count != 0) {
                float invCount = 1.0f / ((float)count * 256.0f);
                float R = sumR[k_idx] * invCount;
                float G = sumG[k_idx] * invCount;
                float B = sumB[k_idx] * invCount;

                float yy = 0.299f * R + 0.587f * G + 0.114f * B;
                shape[0][k_idx] = (int16_t)floorf(219.0f * yy + 16.5f);
                shape[1][k_idx] = (int16_t)floorf(126.336f * (B - yy) + 128.5f);
                shape[2][k_idx] = (int16_t)floorf(159.712f * (R - yy) + 128.5f);
            } else {
                shape[0][k_idx] = 0;
                shape[1][k_idx] = 0;
                shape[2][k_idx] = 0;
            }
        }
    }

    Fdct(shape[0]);
    Fdct(shape[1]);
    Fdct(shape[2]);

    uint8_t YCoeff[64];
    uint8_t CbCoeff[64];
    uint8_t CrCoeff[64];

    YCoeff[0] = (uint8_t)(quant_ydc(shape[0][0] >> 3) >> 1);
    CbCoeff[0] = quant_cdc(shape[1][0] >> 3);
    CrCoeff[0] = quant_cdc(shape[2][0] >> 3);

    for (int i = 1; i < 64; i++) {
        YCoeff[i] = (uint8_t)(quant_ac(shape[0][ZIG_ZAG_ARRAY[i]] >> 1) >> 3);
        CbCoeff[i] = (uint8_t)(quant_ac(shape[1][ZIG_ZAG_ARRAY[i]]) >> 3);
        CrCoeff[i] = (uint8_t)(quant_ac(shape[2][ZIG_ZAG_ARRAY[i]]) >> 3);
    }

    for (int i = 0; i < 21; i++) out_vector[i] = YCoeff[i];
    for (int i = 0; i < 6; i++) out_vector[21 + i] = CbCoeff[i];
    for (int i = 0; i < 6; i++) out_vector[27 + i] = CrCoeff[i];
}
