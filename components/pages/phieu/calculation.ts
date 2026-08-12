import type {
  GroupRow,
  MemberRow,
  PaymentRow,
  PeriodRow,
  Receipt,
  ReceiptDbRow,
  ReceiptLine,
  ShareRow,
} from "./types"
import { isCompleted } from "./utils"

type BuildReceiptsInput = {
  effectiveFrom: string
  effectiveTo: string
  groups: GroupRow[]
  members: MemberRow[]
  payments: PaymentRow[]
  periods: PeriodRow[]
  receiptRows: ReceiptDbRow[]
  shares: ShareRow[]
}

export function buildReceipts({
  effectiveFrom,
  effectiveTo,
  groups,
  members,
  payments,
  periods,
  receiptRows,
  shares,
}: BuildReceiptsInput) {

    if (!effectiveFrom || !effectiveTo || effectiveFrom > effectiveTo) {
      return []
    }

    const groupsById = new Map(groups.map((x) => [x.id, x]))
    const membersById = new Map(members.map((x) => [x.id, x]))
    const sharesByGroup = new Map<string, ShareRow[]>()
    const periodsByGroup = new Map<string, PeriodRow[]>()

    for (const x of shares) {
      const arr = sharesByGroup.get(x.group_id) ?? []
      arr.push(x)
      sharesByGroup.set(x.group_id, arr)
    }

    for (const x of periods) {
      const arr = periodsByGroup.get(x.group_id) ?? []
      arr.push(x)
      periodsByGroup.set(x.group_id, arr)
    }

    const linesByReceiptKey = new Map<
      string,
      { memberId: string; date: string; lines: ReceiptLine[] }
    >()

    for (
      const period of periods.filter(
        (x) =>
          isCompleted(x.status) &&
          x.scheduled_date >= effectiveFrom &&
          x.scheduled_date <= effectiveTo,
      )
    ) {
      const group = groupsById.get(period.group_id)
      if (!group || !period.winner_share_id) continue

      const groupShares = (sharesByGroup.get(group.id) ?? []).filter(
        (x) =>
          x.status === "active" ||
          x.id === period.winner_share_id,
      )

      const groupPeriods = periodsByGroup.get(group.id) ?? []

      const previousWinnerIds = new Set(
        groupPeriods
          .filter(
            (x) =>
              x.period_number < period.period_number &&
              isCompleted(x.status) &&
              x.winner_share_id,
          )
          .map((x) => x.winner_share_id as string),
      )

      const bid = Number(period.bid_amount || 0)
      const contribution = Number(group.contribution_amount || 0)
      const liveContribution = Math.max(0, contribution - bid)
      const amountByShare = new Map<string, number>()
      let pot = 0

      for (const share of groupShares) {
        if (share.id === period.winner_share_id) {
          amountByShare.set(share.id, 0)
          continue
        }

        const amount = previousWinnerIds.has(share.id)
          ? contribution
          : liveContribution

        amountByShare.set(share.id, amount)
        pot += amount
      }

      const winner = groupShares.find(
        (x) => x.id === period.winner_share_id,
      )
      const winnerMemberId = winner?.member_id ?? null
      const fee = Number(
        period.fee_amount ?? group.fee_amount ?? 0,
      )
      const huiAmount = Math.max(0, pot)
      const winnerReceive = Math.max(0, huiAmount - fee)
      const memberIds = new Set(groupShares.map((x) => x.member_id))

      for (const memberId of memberIds) {
        if (!membersById.has(memberId)) continue

        let liveShares = 0
        let deadShares = 0
        let payAmount = 0

        const memberShares = groupShares.filter(
          (x) => x.member_id === memberId,
        )

        for (const share of memberShares) {
          if (share.id === period.winner_share_id) {
            liveShares += 1
            continue
          }

          if (previousWinnerIds.has(share.id)) {
            deadShares += 1
          } else {
            liveShares += 1
          }

          payAmount += amountByShare.get(share.id) ?? 0
        }

        const line: ReceiptLine = {
          periodId: period.id,
          groupId: group.id,
          groupCode: group.code ?? "",
          groupName: group.name,
          periodNumber: period.period_number,
          totalPeriods: Math.max(
            group.total_shares,
            groupPeriods.length,
          ),
          bidAmount: bid,
          liveShares,
          deadShares,
          payAmount,
          huiAmount:
            memberId === winnerMemberId ? huiAmount : 0,
          receiveAmount:
            memberId === winnerMemberId ? winnerReceive : 0,
          feeAmount:
            memberId === winnerMemberId ? fee : 0,
        }

        const key = `${period.scheduled_date}|${memberId}`
        const current = linesByReceiptKey.get(key) ?? {
          memberId,
          date: period.scheduled_date,
          lines: [],
        }
        current.lines.push(line)
        linesByReceiptKey.set(key, current)
      }
    }

    const result: Receipt[] = []

    for (const [key, item] of linesByReceiptKey) {
      const member = membersById.get(item.memberId)
      if (!member) continue

      const lines = item.lines
      const totalPay = lines.reduce((n, x) => n + x.payAmount, 0)
      const totalHuiAmount = lines.reduce((n, x) => n + x.huiAmount, 0)
      const totalReceive = lines.reduce((n, x) => n + x.receiveAmount, 0)
      const totalFee = lines.reduce((n, x) => n + x.feeAmount, 0)

      const db =
        receiptRows.find(
          (x) =>
            x.member_id === item.memberId &&
            x.receipt_date === item.date,
        ) ?? null

      const settlementAmount = Number(db?.settlement_amount ?? 0)
      const netAmount = totalPay - totalReceive + settlementAmount

      const direction: Receipt["direction"] =
        netAmount > 0
          ? "collect"
          : netAmount < 0
            ? "pay"
            : "balanced"

      const allReceiptPayments = db
        ? payments.filter((x) => x.receipt_id === db.id)
        : []

      const activePayments = allReceiptPayments.filter(
        (x) =>
          x.status === "active" &&
          x.direction === direction,
      )

      const paidAmount = activePayments.reduce(
        (n, x) => n + Number(x.amount),
        0,
      )

      const remainingAmount = Math.max(
        0,
        Math.abs(netAmount) - paidAmount,
      )

      let status: Receipt["status"] = db?.status ?? "open"

      if (status !== "cancelled") {
        if (remainingAmount <= 0 && Math.abs(netAmount) > 0) {
          status = "paid"
        } else if (paidAmount > 0) {
          status = "partial"
        } else {
          status = "open"
        }
      }

      result.push({
        key,
        receiptDate: item.date,
        member,
        lines,
        groupCount: new Set(lines.map((x) => x.groupId)).size,
        totalShares: lines.reduce(
          (n, x) => n + x.liveShares + x.deadShares,
          0,
        ),
        liveShares: lines.reduce((n, x) => n + x.liveShares, 0),
        deadShares: lines.reduce((n, x) => n + x.deadShares, 0),
        totalPay,
        totalHuiAmount,
        totalReceive,
        totalFee,
        db,
        payments: allReceiptPayments,
        settlementAmount,
        netAmount,
        paidAmount,
        remainingAmount,
        direction,
        status,
      })
    }

    return result.sort((a, b) => {
      const dateCompare = b.receiptDate.localeCompare(a.receiptDate)
      if (dateCompare !== 0) return dateCompare
      return a.member.full_name.localeCompare(b.member.full_name, "vi")
    })
}
