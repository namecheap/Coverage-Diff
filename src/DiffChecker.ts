import * as core from '@actions/core'
import {CoverageReport} from './Model/CoverageReport'
import {DiffCoverageReport} from './Model/DiffCoverageReport'
import {CoverageData} from './Model/CoverageData'
import {DiffFileCoverageData} from './Model/DiffFileCoverageData'
import {DiffCoverageData} from './Model/DiffCoverageData'

const increasedCoverageIcon = ':green_circle:'
const decreasedCoverageIcon = ':red_circle:'
const newCoverageIcon = ':sparkles: :new:'
const removedCoverageIcon = ':x:'
const notChangedIcon = ':heavy_minus_sign:'

export class DiffChecker {
  private diffCoverageReport: DiffCoverageReport = {}
  constructor(
    coverageReportNew: CoverageReport,
    coverageReportOld: CoverageReport
  ) {
    const reportNewKeys = Object.keys(coverageReportNew)
    const reportOldKeys = Object.keys(coverageReportOld)
    const reportKeys = new Set([...reportNewKeys, ...reportOldKeys])

    for (const filePath of reportKeys) {
      this.diffCoverageReport[filePath] = {
        branches: {
          newPct: this.getPercentage(coverageReportNew[filePath]?.branches),
          oldPct: this.getPercentage(coverageReportOld[filePath]?.branches)
        },
        statements: {
          newPct: this.getPercentage(coverageReportNew[filePath]?.statements),
          oldPct: this.getPercentage(coverageReportOld[filePath]?.statements)
        },
        lines: {
          newPct: this.getPercentage(coverageReportNew[filePath]?.lines),
          oldPct: this.getPercentage(coverageReportOld[filePath]?.lines)
        },
        functions: {
          newPct: this.getPercentage(coverageReportNew[filePath]?.functions),
          oldPct: this.getPercentage(coverageReportOld[filePath]?.functions)
        }
      }
    }
  }

  getCoverageDetails(diffOnly: boolean, currentDirectory: string): string[] {
    const keys = Object.keys(this.diffCoverageReport)
    const returnStrings: string[] = []
    for (const key of keys) {
      if (this.compareCoverageValues(this.diffCoverageReport[key]) !== 0) {
        returnStrings.push(
          this.createDiffLine(
            key.replace(currentDirectory, ''),
            this.diffCoverageReport[key]
          )
        )
      } else {
        if (!diffOnly) {
          returnStrings.push(
            `${notChangedIcon} | ${key.replace(currentDirectory, '')} | ${
              this.diffCoverageReport[key].statements.newPct
            } | ${this.diffCoverageReport[key].branches.newPct} | ${
              this.diffCoverageReport[key].functions.newPct
            } | ${this.diffCoverageReport[key].lines.newPct}`
          )
        }
      }
    }
    return returnStrings
  }

  checkIfTestCoverageFallsBelowDelta(
    delta: number,
    totalDelta: number | null
  ): boolean {
    const files = Object.keys(this.diffCoverageReport)
    for (const file of files) {
      const diffCoverageData = this.diffCoverageReport[file]
      const keys: ('lines' | 'statements' | 'branches' | 'functions')[] = <
        ('lines' | 'statements' | 'branches' | 'functions')[]
      >Object.keys(diffCoverageData)
      // No new coverage found so that means we deleted a file coverage
      const fileRemovedCoverage = Object.values(diffCoverageData).every(
        coverageData => coverageData.newPct === 0
      )
      if (fileRemovedCoverage) {
        core.info(
          `${file} : deleted or renamed and is not considered for coverage diff.`
        )
        // since the file is deleted don't include in delta calculation
        continue
      }
      for (const key of keys) {
        if (diffCoverageData[key].oldPct !== diffCoverageData[key].newPct) {
          const deltaToCompareWith =
            file === 'total' && totalDelta !== null ? totalDelta : delta
          if (
            -this.getPercentageDiff(diffCoverageData[key]) > deltaToCompareWith
          ) {
            const percentageDiff = this.getPercentageDiff(diffCoverageData[key])
            core.info(
              `percentage Diff: ${percentageDiff} is greater than delta for ${file}`
            )
            return true
          }
        }
      }
    }

    return false
  }

  private createDiffLine(
    name: string,
    diffFileCoverageData: DiffFileCoverageData
  ): string {
    // No old coverage found so that means we added a new file coverage
    const fileNewCoverage = Object.values(diffFileCoverageData).every(
      coverageData => coverageData.oldPct === 0
    )
    // No new coverage found so that means we deleted a file coverage
    const fileRemovedCoverage = Object.values(diffFileCoverageData).every(
      coverageData => coverageData.newPct === 0
    )
    if (fileNewCoverage) {
      return ` ${newCoverageIcon} | **${name}** | **${diffFileCoverageData.statements.newPct}** | **${diffFileCoverageData.branches.newPct}** | **${diffFileCoverageData.functions.newPct}** | **${diffFileCoverageData.lines.newPct}**`
    } else if (fileRemovedCoverage) {
      return ` ${removedCoverageIcon} | ~~${name}~~ | ~~${diffFileCoverageData.statements.oldPct}~~ | ~~${diffFileCoverageData.branches.oldPct}~~ | ~~${diffFileCoverageData.functions.oldPct}~~ | ~~${diffFileCoverageData.lines.oldPct}~~`
    }
    // Coverage existed before so calculate the diff status
    const statusIcon = this.getStatusIcon(diffFileCoverageData)
    return ` ${statusIcon} | ${name} | ${
      diffFileCoverageData.statements.newPct
    } **(${this.getPercentageDiff(diffFileCoverageData.statements)})** | ${
      diffFileCoverageData.branches.newPct
    } **(${this.getPercentageDiff(diffFileCoverageData.branches)})** | ${
      diffFileCoverageData.functions.newPct
    } **(${this.getPercentageDiff(diffFileCoverageData.functions)})** | ${
      diffFileCoverageData.lines.newPct
    } **(${this.getPercentageDiff(diffFileCoverageData.lines)})**`
  }

  private compareCoverageValues(
    diffCoverageData: DiffFileCoverageData
  ): number {
    const keys: ('lines' | 'statements' | 'branches' | 'functions')[] = <
      ('lines' | 'statements' | 'branches' | 'functions')[]
    >Object.keys(diffCoverageData)
    for (const key of keys) {
      if (diffCoverageData[key].oldPct !== diffCoverageData[key].newPct) {
        return 1
      }
    }
    return 0
  }

  private getPercentage(coverageData: CoverageData): number {
    return coverageData?.pct || 0
  }

  private getStatusIcon(
    diffFileCoverageData: DiffFileCoverageData
  ): ':green_circle:' | ':red_circle:' {
    let overallDiff = 0
    Object.values(diffFileCoverageData).forEach(coverageData => {
      overallDiff = overallDiff + this.getPercentageDiff(coverageData)
    })
    if (overallDiff < 0) {
      return decreasedCoverageIcon
    }
    return increasedCoverageIcon
  }

  private getPercentageDiff(diffData: DiffCoverageData): number {
    // get diff
    const diff = Number(diffData.newPct) - Number(diffData.oldPct)
    // round off the diff to 2 decimal places
    return Math.round((diff + Number.EPSILON) * 100) / 100
  }
}
