// assembly/color-layout.ts

const resultBuffer = new Uint8Array(33);

// ZigZag table
const arrayZigZag = new Uint8Array(64);
function initZigZag(): void {
  const vals = [
    0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20,
    13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59,
    52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
  ];
  for (let i = 0; i < 64; i++) {
    arrayZigZag[i] = vals[i] as u8;
  }
}

// Cosine table
const arrayCosin = new Float32Array(64);
function initCosin(): void {
  const vals = [
    3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1,
    3.535534e-1, 4.903926e-1, 4.157348e-1, 2.777851e-1, 9.754516e-2, -9.754516e-2, -2.777851e-1,
    -4.157348e-1, -4.903926e-1, 4.619398e-1, 1.913417e-1, -1.913417e-1, -4.619398e-1, -4.619398e-1,
    -1.913417e-1, 1.913417e-1, 4.619398e-1, 4.157348e-1, -9.754516e-2, -4.903926e-1, -2.777851e-1,
    2.777851e-1, 4.903926e-1, 9.754516e-2, -4.157348e-1, 3.535534e-1, -3.535534e-1, -3.535534e-1,
    3.535534e-1, 3.535534e-1, -3.535534e-1, -3.535534e-1, 3.535534e-1, 2.777851e-1, -4.903926e-1,
    9.754516e-2, 4.157348e-1, -4.157348e-1, -9.754516e-2, 4.903926e-1, -2.777851e-1, 1.913417e-1,
    -4.619398e-1, 4.619398e-1, -1.913417e-1, -1.913417e-1, 4.619398e-1, -4.619398e-1, 1.913417e-1,
    9.754516e-2, -2.777851e-1, 4.157348e-1, -4.903926e-1, 4.903926e-1, -4.157348e-1, 2.777851e-1,
    -9.754516e-2,
  ];
  for (let i = 0; i < 64; i++) {
    arrayCosin[i] = vals[i] as f32;
  }
}

let initialized = false;

export function getColorLayout(width: i32, height: i32, dataPtr: usize): usize {
  if (!initialized) {
    initZigZag();
    initCosin();
    initialized = true;
  }

  const shape0 = new Int16Array(64);
  const shape1 = new Int16Array(64);
  const shape2 = new Int16Array(64);

  const sum0 = new Uint32Array(64);
  const sum1 = new Uint32Array(64);
  const sum2 = new Uint32Array(64);

  const cnt = new Int16Array(64);

  let numYCoeff = 21;
  let numCCoeff = 6;

  // result buffers (temp)
  let YCoeff = new Uint8Array(numYCoeff);
  let CbCoeff = new Uint8Array(numCCoeff);
  let CrCoeff = new Uint8Array(numCCoeff);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let offset = (y * width + x) * 3;
      let R = load<u8>(dataPtr + offset + 0);
      let G = load<u8>(dataPtr + offset + 1);
      let B = load<u8>(dataPtr + offset + 2);

      let y_axis = (y as f64) / ((height as f64) / 8.0);
      let x_axis = (x as f64) / ((width as f64) / 8.0);
      let k = ((y_axis as i32) << 3) + (x_axis as i32);

      let yy = (0.299 * (R as f64) + 0.587 * (G as f64) + 0.114 * (B as f64)) / 256.0;

      sum0[k] += (219.0 * yy + 16.5) as u32; // Y
      sum1[k] += (224.0 * 0.564 * ((B as f64) / 256.0 - yy) + 128.5) as u32; // Cb
      sum2[k] += (224.0 * 0.713 * ((R as f64) / 256.0 - yy) + 128.5) as u32; // Cr

      cnt[k]++;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let idx = (i << 3) + j;
      let c = cnt[idx];
      if (c != 0) {
        shape0[idx] = ((sum0[idx] as f64) / c) as f64 as i16;
        shape1[idx] = ((sum1[idx] as f64) / c) as f64 as i16;
        shape2[idx] = ((sum2[idx] as f64) / c) as f64 as i16;
      } else {
        shape0[idx] = 0;
        shape1[idx] = 0;
        shape2[idx] = 0;
      }
    }
  }

  fdct(shape0);
  fdct(shape1);
  fdct(shape2);

  YCoeff[0] = quant_ydc(shape0[0] >> 3) >> 1;
  CbCoeff[0] = quant_cdc(shape1[0] >> 3);
  CrCoeff[0] = quant_cdc(shape2[0] >> 3);

  for (let i = 1; i < 64; i++) {
    if (i < numYCoeff) {
      YCoeff[i] = quant_ac(shape0[arrayZigZag[i]] >> 1) >> 3;
    }
    if (i < numCCoeff) {
      CbCoeff[i] = quant_ac(shape1[arrayZigZag[i]]) >> 3;
      CrCoeff[i] = quant_ac(shape2[arrayZigZag[i]]) >> 3;
    }
  }

  // Combine into resultBuffer
  for (let i = 0; i < numYCoeff; i++) {
    resultBuffer[i] = YCoeff[i];
  }
  for (let i = 0; i < numCCoeff; i++) {
    resultBuffer[numYCoeff + i] = CbCoeff[i];
  }
  for (let i = 0; i < numCCoeff; i++) {
    resultBuffer[numYCoeff + numCCoeff + i] = CrCoeff[i];
  }

  return resultBuffer.dataStart;
}

export function alloc(len: i32): usize {
  return heap.alloc(len as usize);
}

export function free(ptr: usize): void {
  heap.free(ptr);
}

function fdct(shapes: Int16Array): void {
  const dct = new Float32Array(64);
  let s: f32 = 0.0;

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      s = 0.0;
      for (let k = 0; k < 8; k++) {
        s += arrayCosin[j * 8 + k] * (shapes[8 * i + k] as f32);
      }
      dct[8 * i + j] = s;
    }
  }

  for (let j = 0; j < 8; j++) {
    for (let i = 0; i < 8; i++) {
      s = 0.0;
      for (let k = 0; k < 8; k++) {
        s += arrayCosin[i * 8 + k] * dct[8 * k + j];
      }
      shapes[8 * i + j] = Math.floor(s + 0.499999) as i16;
    }
  }
}

function quant_ydc(i: i16): u8 {
  if (i > 192) return (112 + ((i - 192) >> 2)) as u8;
  else if (i > 160) return (96 + ((i - 160) >> 1)) as u8;
  else if (i > 96) return (32 + (i - 96)) as u8;
  else if (i > 64) return (16 + ((i - 64) >> 1)) as u8;
  return (i >> 2) as u8;
}

function quant_cdc(i: i16): u8 {
  if (i > 191) return 63;
  else if (i > 160) return (56 + ((i - 160) >> 2)) as u8;
  else if (i > 144) return (48 + ((i - 144) >> 1)) as u8;
  else if (i > 112) return (16 + (i - 112)) as u8;
  else if (i > 96) return (8 + ((i - 96) >> 1)) as u8;
  else if (i > 64) return ((i - 64) >> 2) as u8;
  return 0;
}

function quant_ac(i: i16): u8 {
  // return 0..255
  let j: i16;
  let val = i;
  if (val < -256) val = -256;
  if (val > 255) val = 255;

  let absVal = Math.abs(val) as i16;

  if (absVal > 127) j = 64 + (absVal >> 2);
  else if (absVal > 63) j = 32 + (absVal >> 1);
  else j = absVal;

  if (val < 0) j = -j;
  return (j + 128) as u8;
}
