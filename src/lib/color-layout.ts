export default (data: Buffer, width: number, height: number) => {
  const numCCoeff = 6;
  const numYCoeff = 21;

  const YCoeff = new Uint8Array(numYCoeff);
  const CbCoeff = new Uint8Array(numCCoeff);
  const CrCoeff = new Uint8Array(numCCoeff);

  const shape = [new Int16Array(64), new Int16Array(64), new Int16Array(64)];
  const sum = [new Uint32Array(64), new Uint32Array(64), new Uint32Array(64)];
  const cnt = new Int16Array(64);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const R = data[(y * width + x) * 3 + 0];
      const G = data[(y * width + x) * 3 + 1];
      const B = data[(y * width + x) * 3 + 2];
      const y_axis = (y / (height / 8)) | 0;
      const x_axis = (x / (width / 8)) | 0;
      const k = (y_axis << 3) + x_axis;
      //RGB to YCbCr, partition and average-calculation
      const yy = (0.299 * R + 0.587 * G + 0.114 * B) / 256;
      sum[0][k] += (219 * yy + 16.5) | 0; // Y
      sum[1][k] += (224 * 0.564 * (B / 256 - yy) + 128.5) | 0; // Cb
      sum[2][k] += (224 * 0.713 * (R / 256 - yy) + 128.5) | 0; // Cr
      cnt[k]++;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      for (let k = 0; k < 3; k++) {
        if (cnt[(i << 3) + j] != 0)
          shape[k][(i << 3) + j] = (sum[k][(i << 3) + j] / cnt[(i << 3) + j]) | 0;
        else shape[k][(i << 3) + j] = 0;
      }
    }
  }

  const Fdct = (shapes) => {
    // prettier-ignore
    const arrayCosin = [
    [3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1, 3.535534e-1],
    [4.903926e-1, 4.157348e-1, 2.777851e-1, 9.754516e-2, -9.754516e-2, -2.777851e-1, -4.157348e-1, -4.903926e-1],
    [4.619398e-1, 1.913417e-1, -1.913417e-1, -4.619398e-1, -4.619398e-1, -1.913417e-1, 1.913417e-1, 4.619398e-1],
    [4.157348e-1, -9.754516e-2, -4.903926e-1, -2.777851e-1, 2.777851e-1, 4.903926e-1, 9.754516e-2, -4.157348e-1],
    [3.535534e-1, -3.535534e-1, -3.535534e-1, 3.535534e-1, 3.535534e-1, -3.535534e-1, -3.535534e-1, 3.535534e-1],
    [2.777851e-1, -4.903926e-1, 9.754516e-2, 4.157348e-1, -4.157348e-1, -9.754516e-2, 4.903926e-1, -2.777851e-1],
    [1.913417e-1, -4.619398e-1, 4.619398e-1, -1.913417e-1, -1.913417e-1, 4.619398e-1, -4.619398e-1, 1.913417e-1],
    [9.754516e-2, -2.777851e-1, 4.157348e-1, -4.903926e-1, 4.903926e-1, -4.157348e-1, 2.777851e-1, -9.754516e-2],
  ];

    const dct = new Float32Array(64);
    let s = 0;

    //calculation of the cos-values of the second sum
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        s = 0;
        for (let k = 0; k < 8; k++) s += arrayCosin[j][k] * shapes[8 * i + k];
        dct[8 * i + j] = s;
      }
    }
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        s = 0;
        for (let k = 0; k < 8; k++) s += arrayCosin[i][k] * dct[8 * k + j];
        shapes[8 * i + j] = Math.floor(s + 0.499999);
      }
    }
  };

  Fdct(shape[0]);
  Fdct(shape[1]);
  Fdct(shape[2]);

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

  // prettier-ignore
  const arrayZigZag = new Uint8Array([0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63]);

  YCoeff[0] = quant_ydc(shape[0][0] >> 3) >> 1;
  CbCoeff[0] = quant_cdc(shape[1][0] >> 3);
  CrCoeff[0] = quant_cdc(shape[2][0] >> 3);

  //quantization and zig-zagging
  for (let i = 1; i < 64; i++) {
    YCoeff[i] = quant_ac(shape[0][arrayZigZag[i]] >> 1) >> 3;
    CbCoeff[i] = quant_ac(shape[1][arrayZigZag[i]]) >> 3;
    CrCoeff[i] = quant_ac(shape[2][arrayZigZag[i]]) >> 3;
  }

  // const featureVector = new Uint8Array([...YCoeff, ...CbCoeff, ...CrCoeff]);

  // const cl_hi = Buffer.from([numYCoeff, numCCoeff, ...featureVector]).toString("base64");

  // console.log(featureVector.length, featureVector);
  // console.log(cl_hi);
  // console.log(new Uint8Array(Buffer.alloc(35, cl_hi, "base64")).slice(2));

  return [...YCoeff, ...CbCoeff, ...CrCoeff];
};
