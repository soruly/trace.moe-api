// prettier-ignore
const COSINE_ARRAY = [
    [3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1],
    [4.903926e-1, 4.157348e-1, 2.777851e-1, 9.754516e-2, -9.754516e-2, -2.777851e-1, -4.157348e-1, -4.903926e-1],
    [4.619398e-1, 1.913417e-1, -1.913417e-1, -4.619398e-1, -4.619398e-1, -1.913417e-1, 1.913417e-1, 4.619398e-1],
    [4.157348e-1, -9.754516e-2, -4.903926e-1, -2.777851e-1, 2.777851e-1, 4.903926e-1, 9.754516e-2, -4.157348e-1],
    [3.535534e-1, -3.535534e-1, -3.535534e-1, 3.535534e-1, 3.535534e-1, -3.535534e-1, -3.535534e-1, 3.535534e-1],
    [2.777851e-1, -4.903926e-1, 9.754516e-2, 4.157348e-1, -4.157348e-1, -9.754516e-2, 4.903926e-1, -2.777851e-1],
    [1.913417e-1, -4.619398e-1, 4.619398e-1, -1.913417e-1, -1.913417e-1, 4.619398e-1, -4.619398e-1, 1.913417e-1],
    [9.754516e-2, -2.777851e-1, 4.157348e-1, -4.903926e-1, 4.903926e-1, -4.157348e-1, 2.777851e-1, -9.754516e-2],
  ];

const Fdct = (shapes) => {
  const dct = new Float32Array(64);
  let s = 0;

  //calculation of the cos-values of the second sum
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      s = 0;
      for (let k = 0; k < 8; k++) s += COSINE_ARRAY[j][k] * shapes[8 * i + k];
      dct[8 * i + j] = s;
    }
  }
  for (let j = 0; j < 8; j++) {
    for (let i = 0; i < 8; i++) {
      s = 0;
      for (let k = 0; k < 8; k++) s += COSINE_ARRAY[i][k] * dct[8 * k + j];
      shapes[8 * i + j] = Math.floor(s + 0.499999);
    }
  }
};

const quant_ydc = (i) => {
  // 255 -> 127
  if (i > 192) return 112 + ((i - 192) >> 2);
  else if (i > 160) return 96 + ((i - 160) >> 1);
  else if (i > 96) return 32 + (i - 96);
  else if (i > 64) return 16 + ((i - 64) >> 1);
  return i >> 2;
};

const quant_cdc = (i) => {
  // return 0..63
  if (i > 191) return 63;
  else if (i > 160) return 56 + ((i - 160) >> 2);
  else if (i > 144) return 48 + ((i - 144) >> 1);
  else if (i > 112) return 16 + (i - 112);
  else if (i > 96) return 8 + ((i - 96) >> 1);
  else if (i > 64) return (i - 64) >> 2;
  return 0;
};

const quant_ac = (i) => {
  // return 0..255
  let j;
  i = Math.min(Math.max(-256, i), 255);
  if (Math.abs(i) > 127) j = 64 + (Math.abs(i) >> 2);
  else if (Math.abs(i) > 63) j = 32 + (Math.abs(i) >> 1);
  else j = Math.abs(i);
  if (i < 0) j = -j;
  return j + 128;
};

const ZIG_ZAG_ARRAY = new Uint8Array([
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20,
  13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52,
  45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
]);

export default (data: Buffer, width: number, height: number) => {
  const YCoeff = new Uint8Array(21);
  const CbCoeff = new Uint8Array(6);
  const CrCoeff = new Uint8Array(6);

  const shape = [new Int16Array(64), new Int16Array(64), new Int16Array(64)];

  const x_start = new Int32Array(9);
  const y_start = new Int32Array(9);
  for (let i = 0; i <= 8; i++) {
    x_start[i] = Math.ceil((i * width) / 8);
    y_start[i] = Math.ceil((i * height) / 8);
  }

  for (let by = 0; by < 8; by++) {
    const y_begin = y_start[by];
    const y_end = y_start[by + 1];

    for (let bx = 0; bx < 8; bx++) {
      const x_begin = x_start[bx];
      const x_end = x_start[bx + 1];
      const k_idx = (by << 3) + bx;

      let s0 = 0;
      let s1 = 0;
      let s2 = 0;
      let count = 0;

      for (let y = y_begin; y < y_end; y++) {
        let ptr = (y * width + x_begin) * 3;
        for (let x = x_begin; x < x_end; x++) {
          const R = data[ptr];
          const G = data[ptr + 1];
          const B = data[ptr + 2];
          ptr += 3;

          const yy = (0.299 * R + 0.587 * G + 0.114 * B) / 256;
          s0 += (219 * yy + 16.5) | 0; // Y
          s1 += (224 * 0.564 * (B / 256 - yy) + 128.5) | 0; // Cb
          s2 += (224 * 0.713 * (R / 256 - yy) + 128.5) | 0; // Cr
          count++;
        }
      }

      if (count !== 0) {
        shape[0][k_idx] = (s0 / count) | 0;
        shape[1][k_idx] = (s1 / count) | 0;
        shape[2][k_idx] = (s2 / count) | 0;
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

  YCoeff[0] = quant_ydc(shape[0][0] >> 3) >> 1;
  CbCoeff[0] = quant_cdc(shape[1][0] >> 3);
  CrCoeff[0] = quant_cdc(shape[2][0] >> 3);

  //quantization and zig-zagging
  for (let i = 1; i < 64; i++) {
    YCoeff[i] = quant_ac(shape[0][ZIG_ZAG_ARRAY[i]] >> 1) >> 3;
    CbCoeff[i] = quant_ac(shape[1][ZIG_ZAG_ARRAY[i]]) >> 3;
    CrCoeff[i] = quant_ac(shape[2][ZIG_ZAG_ARRAY[i]]) >> 3;
  }

  // const featureVector = new Uint8Array([...YCoeff, ...CbCoeff, ...CrCoeff]);
  // const cl_hi = Buffer.from([21, 6, ...featureVector]).toString("base64");

  // console.log(featureVector.length, featureVector);
  // console.log(new Uint8Array(Buffer.alloc(35, cl_hi, "base64")).slice(2));

  return [...YCoeff, ...CbCoeff, ...CrCoeff];
};
