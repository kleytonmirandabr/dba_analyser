import { AlignedPair } from './types'

// LCS-based line alignment algorithm
export function computeAlignedDiff(srcLines: string[], tgtLines: string[]): AlignedPair[] {
  const n = srcLines.length, m = tgtLines.length
  
  if (n > 2000 || m > 2000) {
    return simpleDiff(srcLines, tgtLines)
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (srcLines[i-1].trim() === tgtLines[j-1].trim()) {
        dp[i][j] = dp[i-1][j-1] + 1
      } else {
        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1])
      }
    }
  }

  let i = n, j = m
  const lcsReverse: AlignedPair[] = []
  
  while (i > 0 && j > 0) {
    if (srcLines[i-1].trim() === tgtLines[j-1].trim()) {
      lcsReverse.push({ type: 'same', srcIdx: i-1, tgtIdx: j-1 })
      i--; j--
    } else if (dp[i-1][j] >= dp[i][j-1]) {
      lcsReverse.push({ type: 'remove', srcIdx: i-1 })
      i--
    } else {
      lcsReverse.push({ type: 'add', tgtIdx: j-1 })
      j--
    }
  }
  while (i > 0) { lcsReverse.push({ type: 'remove', srcIdx: i-1 }); i-- }
  while (j > 0) { lcsReverse.push({ type: 'add', tgtIdx: j-1 }); j-- }

  const aligned = lcsReverse.reverse()

  // Post-process: convert adjacent remove+add pairs into 'changed' pairs
  const result: AlignedPair[] = []
  let idx = 0
  while (idx < aligned.length) {
    if (aligned[idx].type === 'remove' && idx + 1 < aligned.length && aligned[idx+1].type === 'add') {
      result.push({ type: 'changed', srcIdx: aligned[idx].srcIdx, tgtIdx: aligned[idx+1].tgtIdx })
      idx += 2
    } else if (aligned[idx].type === 'add' && idx + 1 < aligned.length && aligned[idx+1].type === 'remove') {
      result.push({ type: 'changed', srcIdx: aligned[idx+1].srcIdx, tgtIdx: aligned[idx].tgtIdx })
      idx += 2
    } else {
      result.push(aligned[idx])
      idx++
    }
  }

  return result
}

function simpleDiff(srcLines: string[], tgtLines: string[]): AlignedPair[] {
  const result: AlignedPair[] = []
  const maxLen = Math.max(srcLines.length, tgtLines.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < srcLines.length && i < tgtLines.length) {
      if (srcLines[i].trim() === tgtLines[i].trim()) {
        result.push({ type: 'same', srcIdx: i, tgtIdx: i })
      } else {
        result.push({ type: 'changed', srcIdx: i, tgtIdx: i })
      }
    } else if (i < srcLines.length) {
      result.push({ type: 'remove', srcIdx: i })
    } else {
      result.push({ type: 'add', tgtIdx: i })
    }
  }
  return result
}

// Word-level diff for highlighting exact changes within a line
export function computeWordHighlights(srcLine: string, tgtLine: string): { srcHighlights: {start:number;end:number}[]; tgtHighlights: {start:number;end:number}[] } {
  const tokenize = (s: string) => {
    const tokens: { text: string; start: number }[] = []
    let i = 0
    while (i < s.length) {
      const start = i
      if (/\s/.test(s[i])) {
        while (i < s.length && /\s/.test(s[i])) i++
      } else if (/[\w@]/.test(s[i])) {
        while (i < s.length && /[\w@]/.test(s[i])) i++
      } else {
        while (i < s.length && !/[\s\w@]/.test(s[i])) i++
      }
      tokens.push({ text: s.substring(start, i), start })
    }
    return tokens
  }

  const srcTokens = tokenize(srcLine)
  const tgtTokens = tokenize(tgtLine)
  
  const n = srcTokens.length, m = tgtTokens.length
  if (n === 0 && m === 0) return { srcHighlights: [], tgtHighlights: [] }
  if (n > 200 || m > 200) {
    return { 
      srcHighlights: [{ start: 0, end: srcLine.length }], 
      tgtHighlights: [{ start: 0, end: tgtLine.length }] 
    }
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (srcTokens[i-1].text === tgtTokens[j-1].text) {
        dp[i][j] = dp[i-1][j-1] + 1
      } else {
        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1])
      }
    }
  }

  const srcInLcs = new Set<number>()
  const tgtInLcs = new Set<number>()
  let si = n, ti = m
  while (si > 0 && ti > 0) {
    if (srcTokens[si-1].text === tgtTokens[ti-1].text) {
      srcInLcs.add(si-1); tgtInLcs.add(ti-1)
      si--; ti--
    } else if (dp[si-1][ti] >= dp[si][ti-1]) {
      si--
    } else {
      ti--
    }
  }

  const srcHighlights: {start:number;end:number}[] = []
  const tgtHighlights: {start:number;end:number}[] = []

  for (let i = 0; i < srcTokens.length; i++) {
    if (!srcInLcs.has(i) && srcTokens[i].text.trim()) {
      srcHighlights.push({ start: srcTokens[i].start, end: srcTokens[i].start + srcTokens[i].text.length })
    }
  }
  for (let i = 0; i < tgtTokens.length; i++) {
    if (!tgtInLcs.has(i) && tgtTokens[i].text.trim()) {
      tgtHighlights.push({ start: tgtTokens[i].start, end: tgtTokens[i].start + tgtTokens[i].text.length })
    }
  }

  const merge = (hl: {start:number;end:number}[]) => {
    if (hl.length <= 1) return hl
    const merged: {start:number;end:number}[] = [hl[0]]
    for (let i = 1; i < hl.length; i++) {
      const last = merged[merged.length - 1]
      if (hl[i].start <= last.end + 1) {
        last.end = Math.max(last.end, hl[i].end)
      } else {
        merged.push(hl[i])
      }
    }
    return merged
  }

  return { srcHighlights: merge(srcHighlights), tgtHighlights: merge(tgtHighlights) }
}
