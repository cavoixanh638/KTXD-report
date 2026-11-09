/* Exact decimal arithmetic based on scaled BigInt. No binary floating point is
   used for persisted money/area, aggregation, or display rounding. */
(function (root) {
  'use strict';
  function p10(n) { if (!Number.isInteger(n) || n < 0 || n > 1000) throw Error('Invalid decimal scale'); return 10n ** BigInt(n); }
  class Dec {
    constructor(i, s = 0) {
      this.i = BigInt(i); this.s = s;
      if (!Number.isInteger(s) || s < 0 || s > 1000) throw Error('Invalid decimal scale');
      if (this.i === 0n) this.s = 0;
      while (this.s > 0 && this.i % 10n === 0n) { this.i /= 10n; this.s--; }
    }
    static of(x) {
      if (x instanceof Dec) return x;
      if (typeof x === 'bigint') return new Dec(x, 0);
      if (typeof x === 'number' && !Number.isFinite(x)) throw Error('Nonfinite decimal');
      let s = String(x ?? '').trim();
      let m = s.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
      if (!m) throw Error('Invalid decimal: ' + s);
      let frac = m[3] || '', exponent = Number(m[4] || 0), scale = frac.length - exponent;
      let integer = BigInt((m[1] || '') + (m[2] + frac));
      if (scale < 0) return new Dec(integer * p10(-scale), 0);
      return new Dec(integer, scale);
    }
    add(b) { b=Dec.of(b); const s=Math.max(this.s,b.s); return new Dec(this.i*p10(s-this.s)+b.i*p10(s-b.s),s); }
    sub(b) { b=Dec.of(b); const s=Math.max(this.s,b.s); return new Dec(this.i*p10(s-this.s)-b.i*p10(s-b.s),s); }
    mul(b) { b=Dec.of(b); return new Dec(this.i*b.i,this.s+b.s); }
    div(b, digits = 22) {
      b=Dec.of(b); if(b.i===0n) throw Error('Division by zero');
      const numerator = this.i*p10(digits+b.s), denominator = b.i*p10(this.s);
      let sign = (numerator<0n)!==(denominator<0n)?-1n:1n;
      let a=numerator<0n?-numerator:numerator, c=denominator<0n?-denominator:denominator;
      let q=a/c,r=a%c;if(r*2n>=c) q++;
      return new Dec(q*sign,digits);
    }
    neg() { return new Dec(-this.i,this.s); }
    abs() { return this.i<0n?this.neg():this; }
    cmp(b) { b=Dec.of(b); const s=Math.max(this.s,b.s),a=this.i*p10(s-this.s),c=b.i*p10(s-b.s); return a<c?-1:a>c?1:0; }
    isZero() { return this.i===0n; }
    toString() {
      let neg=this.i<0n, digits=(neg?-this.i:this.i).toString().padStart(this.s+1,'0');
      return (neg?'-':'')+(this.s?digits.slice(0,-this.s)+'.'+digits.slice(-this.s):digits);
    }
    fixed(n=2) {
      if(!Number.isInteger(n)||n<0||n>50) throw Error('Invalid precision');
      let i=this.i,s=this.s;
      if(s>n){let factor=p10(s-n);let a=i<0n?-i:i;let q=a/factor,r=a%factor;if(r*2n>=factor)q++;i=i<0n?-q:q;s=n;}
      else if (s<n){i*=p10(n-s);s=n;}
      const neg=i<0n;let t=(neg?-i:i).toString().padStart(n+1,'0');
      return (neg?'-':'')+(n?t.slice(0,-n)+'.'+t.slice(-n):t);
    }
    static sum(items){return items.reduce((a,b)=>a.add(b),Dec.of('0'));}
  }
  root.KTXH = root.KTXH || {};
  root.KTXH.Dec = Dec;
  if (typeof module !== 'undefined' && module.exports) module.exports = Dec;
})(typeof globalThis !== 'undefined' ? globalThis : this);
