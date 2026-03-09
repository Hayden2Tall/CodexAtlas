export interface DiffSegment {
  text: string;
  type: "same" | "added" | "removed" | "changed";
}

/**
 * Longest Common Subsequence for word arrays.
 * Returns the LCS length table for backtracking.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp;
}

export function computeWordDiff(
  textA: string,
  textB: string
): { segmentsA: DiffSegment[]; segmentsB: DiffSegment[] } {
  const wordsA = textA.split(/\s+/).filter(Boolean);
  const wordsB = textB.split(/\s+/).filter(Boolean);

  const dp = lcsTable(wordsA, wordsB);

  const segmentsA: DiffSegment[] = [];
  const segmentsB: DiffSegment[] = [];

  let i = wordsA.length;
  let j = wordsB.length;

  const opsA: DiffSegment[] = [];
  const opsB: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      opsA.push({ text: wordsA[i - 1], type: "same" });
      opsB.push({ text: wordsB[j - 1], type: "same" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      opsB.push({ text: wordsB[j - 1], type: "added" });
      j--;
    } else {
      opsA.push({ text: wordsA[i - 1], type: "removed" });
      i--;
    }
  }

  opsA.reverse();
  opsB.reverse();

  mergeConsecutive(opsA, segmentsA);
  mergeConsecutive(opsB, segmentsB);

  return { segmentsA, segmentsB };
}

function mergeConsecutive(ops: DiffSegment[], out: DiffSegment[]) {
  for (const op of ops) {
    const last = out[out.length - 1];
    if (last && last.type === op.type) {
      last.text += " " + op.text;
    } else {
      out.push({ ...op });
    }
  }
}
