"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  CheckCircle2,
  Dices,
  RotateCw,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export type LuckyWheelCandidate = {
  share: {
    id: string
    share_number: number
  }
  member: {
    full_name: string
  } | null
}

function secureRandomIndex(length: number) {
  if (length <= 1) return 0

  const maxUint = 0xffffffff
  const limit =
    maxUint - ((maxUint + 1) % length)

  const buffer = new Uint32Array(1)

  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] > limit)

  return buffer[0] % length
}

export function LuckyWheelDialog({
  candidates,
  onClose,
  onConfirm,
}: {
  candidates: LuckyWheelCandidate[]
  onClose: () => void
  onConfirm: (
    candidate: LuckyWheelCandidate,
  ) => void
}) {
  const [rotation, setRotation] =
    useState(0)

  const [spinning, setSpinning] =
    useState(false)

  const [result, setResult] =
    useState<LuckyWheelCandidate | null>(
      null,
    )

  const timerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(
          timerRef.current,
        )
      }
    }
  }, [])

  const count = Math.max(
    candidates.length,
    1,
  )

  const sliceAngle =
    360 / count

  const wheelGradient =
    useMemo(() => {
      const colors = [
        "#dbeafe",
        "#fef3c7",
        "#dcfce7",
        "#f3e8ff",
      ]

      return `conic-gradient(${candidates
        .map((_, index) => {
          const start =
            index * sliceAngle

          const end =
            (index + 1) *
            sliceAngle

          return `${
            colors[
              index %
                colors.length
            ]
          } ${start}deg ${end}deg`
        })
        .join(", ")})`
    }, [
      candidates,
      sliceAngle,
    ])

  function spinWheel() {
    if (
      spinning ||
      candidates.length === 0
    ) {
      return
    }

    if (timerRef.current) {
      clearTimeout(
        timerRef.current,
      )
    }

    const winnerIndex =
      secureRandomIndex(
        candidates.length,
      )

    const chosenCenter =
      winnerIndex *
        sliceAngle +
      sliceAngle / 2

    const desiredAngle =
      (360 - chosenCenter) %
      360

    setResult(null)
    setSpinning(true)

    setRotation((current) => {
      const currentAngle =
        ((current % 360) + 360) %
        360

      const adjustment =
        (desiredAngle -
          currentAngle +
          360) %
        360

      return (
        current +
        8 * 360 +
        adjustment
      )
    })

    timerRef.current =
      setTimeout(() => {
        setResult(
          candidates[
            winnerIndex
          ],
        )

        setSpinning(false)
      }, 5050)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Bốc thăm người hốt"
    >
      <Card className="max-h-[96vh] w-full max-w-lg overflow-y-auto p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Dices className="size-5 shrink-0 text-primary" />

              <h2 className="text-lg font-bold">
                Bốc thăm người hốt
              </h2>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {candidates.length} chân đủ điều kiện tham gia
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={spinning}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        {candidates.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-semibold">
              Không còn chân đủ điều kiện bốc thăm
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 flex justify-center">
              <div className="relative h-[300px] w-[300px] sm:h-[340px] sm:w-[340px]">
                <div className="absolute left-1/2 top-[-4px] z-30 -translate-x-1/2">
                  <div
                    className="h-0 w-0 border-x-[15px] border-t-[26px] border-x-transparent border-t-foreground"
                    aria-hidden="true"
                  />
                </div>

                <div className="absolute inset-1 rounded-full border border-border bg-card shadow-sm" />

                <div
                  className="absolute inset-3 overflow-hidden rounded-full border-4 border-background shadow-md"
                  style={{
                    background:
                      wheelGradient,

                    transform: `rotate(${rotation}deg)`,

                    transition:
                      spinning
                        ? "transform 5s cubic-bezier(0.08, 0.72, 0.12, 1)"
                        : "none",
                  }}
                >
                  <div className="absolute inset-[27%] rounded-full border-2 border-background/80 bg-background/15" />

                  {candidates.map(
                    (
                      candidate,
                      index,
                    ) => {
                      const angle =
                        index *
                          sliceAngle +
                        sliceAngle /
                          2

                      const radius =
                        candidates.length >
                        30
                          ? 122
                          : 126

                      return (
                        <div
                          key={
                            candidate
                              .share.id
                          }
                          className="absolute left-1/2 top-1/2 h-0 w-0"
                          style={{
                            transform: `rotate(${angle}deg)`,
                          }}
                        >
                          <span
                            className="absolute left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-background/80 text-[10px] font-bold tabular-nums text-foreground sm:text-[11px]"
                            style={{
                              top: `-${radius}px`,

                              transform: `rotate(${-angle}deg)`,
                            }}
                          >
                            {
                              candidate
                                .share
                                .share_number
                            }
                          </span>
                        </div>
                      )
                    },
                  )}

                  <div className="absolute left-1/2 top-1/2 z-20 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-md">
                    {spinning ? (
                      <RotateCw className="size-6 animate-spin" />
                    ) : (
                      <Dices className="size-6" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="mt-5 min-h-[92px] rounded-lg border bg-muted/30 p-4 text-center"
              aria-live="polite"
            >
              {spinning ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Đang bốc thăm
                  </p>

                  <p className="mt-2 font-semibold">
                    Vòng quay đang giảm tốc...
                  </p>
                </>
              ) : result ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Kết quả
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    Chân{" "}
                    {
                      result
                        .share
                        .share_number
                    }
                  </p>

                  <p className="mt-1 font-semibold text-primary">
                    {result.member
                      ?.full_name ??
                      "Không rõ"}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">
                    Sẵn sàng bốc thăm
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Chỉ các chân chưa từng hốt mới có trong vòng quay.
                  </p>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                className="h-12 text-base font-bold"
                disabled={spinning}
                onClick={spinWheel}
              >
                <Dices className="size-5" />

                {result
                  ? "Quay lại"
                  : "QUAY"}
              </Button>

              {result && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={spinning}
                  onClick={() =>
                    onConfirm(result)
                  }
                >
                  <CheckCircle2 className="size-4" />
                  Chọn người này
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                disabled={spinning}
                onClick={onClose}
              >
                Hủy
              </Button>
            </div>

            <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
              Kết quả chỉ được đưa vào kỳ hụi sau khi bạn chọn người này và chốt kỳ.
            </p>
          </>
        )}
      </Card>
    </div>
  )
}
