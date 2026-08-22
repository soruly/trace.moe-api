#ifndef TRACE_MOE_COLOR_LAYOUT_H
#define TRACE_MOE_COLOR_LAYOUT_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define COLOR_LAYOUT_VECTOR_SIZE 33
#define COLOR_LAYOUT_WIDTH 320
#define COLOR_LAYOUT_HEIGHT 180

/**
 * Extracts the MPEG-7 Color Layout Descriptor (33 bytes) from an RGB24 image buffer.
 *
 * @param rgb_data  Pointer to contiguous RGB24 pixel buffer (width * height * 3 bytes)
 * @param width     Image width (e.g. 320)
 * @param height    Image height (e.g. 180)
 * @param out_vector Output array of 33 bytes (21 Y, 6 Cb, 6 Cr)
 */
void extract_color_layout(const uint8_t *rgb_data, int width, int height, uint8_t out_vector[COLOR_LAYOUT_VECTOR_SIZE]);

#ifdef __cplusplus
}
#endif

#endif /* TRACE_MOE_COLOR_LAYOUT_H */
