export type PerformanceShare = {
  id: string
  member_id: string
  share_number: number
  status: string
}

export type PerformancePeriod = {
  period_number: number
  winner_share_id: string | null
  bid_amount: number
  status: string
}

export type SharePerformance = {
  shareId: string
  memberId: string
  shareNumber: number
  hasWon: boolean
  wonPeriodNumber: number | null
  benefitAmount: number
  costAmount: number
  performanceAmount: number
}

export type MemberPerformance = {
  memberId: string
  shareCount: number
  wonShares: number
  liveShares: number
  benefitAmount: number
  costAmount: number
  performanceAmount: number
  shares: SharePerformance[]
}

export type GroupPerformance = {
  totalBenefitAmount: number
  totalCostAmount: number
  performanceAmount: number
  members: MemberPerformance[]
  shares: SharePerformance[]
}

function isFinished(status: string) {
  return status === "completed" || status === "opened"
}

export function calculateGroupPerformance(
  shares: PerformanceShare[],
  periods: PerformancePeriod[],
): GroupPerformance {
  const finishedPeriods = [...periods]
    .filter((period) => isFinished(period.status) && period.winner_share_id)
    .sort((a, b) => a.period_number - b.period_number)

  const wonShareIds = new Set(
    finishedPeriods
      .map((period) => period.winner_share_id)
      .filter((id): id is string => Boolean(id)),
  )

  const eligibleShares = shares.filter(
    (share) => share.status === "active" || wonShareIds.has(share.id),
  )

  const byShare = new Map<string, SharePerformance>()
  for (const share of eligibleShares) {
    byShare.set(share.id, {
      shareId: share.id,
      memberId: share.member_id,
      shareNumber: share.share_number,
      hasWon: false,
      wonPeriodNumber: null,
      benefitAmount: 0,
      costAmount: 0,
      performanceAmount: 0,
    })
  }

  const previousWinnerIds = new Set<string>()

  for (const period of finishedPeriods) {
    const winnerShareId = period.winner_share_id
    if (!winnerShareId) continue

    const bid = Math.max(0, Number(period.bid_amount || 0))
    const liveBeforeThisPeriod = eligibleShares.filter(
      (share) => !previousWinnerIds.has(share.id),
    )

    for (const share of liveBeforeThisPeriod) {
      const performance = byShare.get(share.id)
      if (!performance) continue

      if (share.id === winnerShareId) {
        const liveOtherShares = liveBeforeThisPeriod.filter(
          (item) => item.id !== winnerShareId,
        ).length
        performance.hasWon = true
        performance.wonPeriodNumber = period.period_number
        performance.costAmount += bid * liveOtherShares
      } else {
        performance.benefitAmount += bid
      }
    }

    previousWinnerIds.add(winnerShareId)
  }

  const sharePerformance = [...byShare.values()]
    .map((item) => ({
      ...item,
      performanceAmount: item.benefitAmount - item.costAmount,
    }))
    .sort((a, b) => a.shareNumber - b.shareNumber)

  const memberMap = new Map<string, MemberPerformance>()
  for (const share of sharePerformance) {
    const current = memberMap.get(share.memberId) ?? {
      memberId: share.memberId,
      shareCount: 0,
      wonShares: 0,
      liveShares: 0,
      benefitAmount: 0,
      costAmount: 0,
      performanceAmount: 0,
      shares: [],
    }

    current.shareCount += 1
    current.wonShares += share.hasWon ? 1 : 0
    current.liveShares += share.hasWon ? 0 : 1
    current.benefitAmount += share.benefitAmount
    current.costAmount += share.costAmount
    current.performanceAmount += share.performanceAmount
    current.shares.push(share)
    memberMap.set(share.memberId, current)
  }

  const members = [...memberMap.values()]
  const totalBenefitAmount = sharePerformance.reduce(
    (sum, item) => sum + item.benefitAmount,
    0,
  )
  const totalCostAmount = sharePerformance.reduce(
    (sum, item) => sum + item.costAmount,
    0,
  )

  return {
    totalBenefitAmount,
    totalCostAmount,
    performanceAmount: totalBenefitAmount - totalCostAmount,
    members,
    shares: sharePerformance,
  }
}
