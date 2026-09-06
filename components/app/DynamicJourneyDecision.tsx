"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Navigation,
  Train,
  Clock,
  ShieldCheck,
  Zap,
  Sliders,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Info,
  Radio,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resolveLocationAsync } from "@/lib/geo/location-resolver";
import { resolveAndRankJourneyAsync } from "@/lib/geo/journey-ranker";
import type { JourneyResolutionResult, ResolvedLocation, RankedJourneyOption } from "@/lib/geo/types";

interface DynamicJourneyDecisionProps {
  initialOrigin?: string;
  initialDestination?: string;
  onProceedToBooking?: (selectedOption: RankedJourneyOption) => void;
}

export function DynamicJourneyDecision({
  initialOrigin = "Life Republic Pune",
  initialDestination = "Kolkata",
  onProceedToBooking,
}: DynamicJourneyDecisionProps) {
  const [originInput, setOriginInput] = useState(initialOrigin);
  const [destInput, setDestInput] = useState(initialDestination);
  const [boardingPref, setBoardingPref] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("3A");
  const [priority, setPriority] = useState<"safest" | "cheapest" | "fastest">("safest");

  const [loading, setLoading] = useState(false);
  const [resolution, setResolution] = useState<JourneyResolutionResult | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function runResolution() {
      setLoading(true);
      try {
        const originRes = await resolveLocationAsync(originInput);
        const destRes = await resolveLocationAsync(destInput);

        if (!originRes || !destRes) {
          if (active) setLoading(false);
          return;
        }

        const res = await resolveAndRankJourneyAsync(originRes, destRes, {
          boardingStationPreference: boardingPref || undefined,
          preferredClass: selectedClass,
          priority,
        });

        if (active) {
          setResolution(res);
          if (res.primary) {
            setSelectedOptionId(res.primary.optionId);
          }
          setLoading(false);
        }
      } catch (err) {
        console.warn("[DynamicJourneyDecision] Resolution error:", err);
        if (active) setLoading(false);
      }
    }

    runResolution();
    return () => { active = false; };
  }, [originInput, destInput, boardingPref, selectedClass, priority]);

  if (loading && !resolution) {
    return (
      <Card className="p-8 text-center bg-surface border border-line">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="text-sm font-medium text-ink">Discovering dynamic railway routes & Places resolution...</p>
        </div>
      </Card>
    );
  }

  const primary = resolution?.primary;
  const selectedOption = resolution?.rankedOptions.find((o) => o.optionId === selectedOptionId) || primary;

  return (
    <div className="space-y-6">
      {/* Header & Location Resolution Lineage */}
      <Card className="p-6 border border-line bg-surface shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                <Navigation className="h-3 w-3" /> Live Provider Pipeline Active
              </span>
              {resolution?.origin?.source && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-mono text-ink-soft">
                  Places: {resolution.origin.source.toUpperCase()}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-bold text-ink">Dynamic Journey Resolution</h2>
            <p className="text-sm text-ink-soft">
              Calculates door-to-door transit, nearby station discovery, and real train routes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              placeholder="Origin place..."
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink bg-surface shadow-xs focus:outline-none focus:border-brand"
            />
            <ArrowRight className="h-4 w-4 text-ink-faint hidden sm:block" />
            <input
              type="text"
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              placeholder="Destination..."
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink bg-surface shadow-xs focus:outline-none focus:border-brand"
            />
          </div>
        </div>

        {/* Resolved Coordinates & Station Nodes */}
        {resolution && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-surface-muted p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Origin Location</span>
                <span className="text-xs font-medium text-confirm">
                  Confidence: {Math.round((resolution.origin.confidence || 0.95) * 100)}%
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand" />
                <span className="text-sm font-semibold text-ink">{resolution.origin.name}</span>
                <span className="text-xs text-ink-soft">({resolution.origin.city})</span>
              </div>
              {resolution.origin.coordinates && (
                <div className="mt-1 text-xs font-mono text-ink-faint">
                  Coords: {resolution.origin.coordinates.latitude.toFixed(4)}, {resolution.origin.coordinates.longitude.toFixed(4)}
                </div>
              )}
            </div>

            <div className="rounded-lg bg-surface-muted p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Destination Location</span>
                <span className="text-xs font-medium text-confirm">
                  Confidence: {Math.round((resolution.destination.confidence || 0.95) * 100)}%
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand" />
                <span className="text-sm font-semibold text-ink">{resolution.destination.name}</span>
                <span className="text-xs text-ink-soft">({resolution.destination.city})</span>
              </div>
              {resolution.destination.coordinates && (
                <div className="mt-1 text-xs font-mono text-ink-faint">
                  Coords: {resolution.destination.coordinates.latitude.toFixed(4)}, {resolution.destination.coordinates.longitude.toFixed(4)}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Discovered Candidate Stations */}
      {resolution && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border border-line bg-surface">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">
              Discovered Boarding Stations ({resolution.candidateOriginStations.length})
            </h3>
            <div className="space-y-2">
              {resolution.candidateOriginStations.map((st) => (
                <div
                  key={st.station.code}
                  onClick={() => setBoardingPref(st.station.code)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    boardingPref === st.station.code
                      ? "border-brand bg-brand-soft/40"
                      : "border-line bg-surface-muted hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Train className="h-4 w-4 text-brand" />
                    <div>
                      <span className="font-semibold text-ink">{st.station.name} ({st.station.code})</span>
                      <div className="text-[0.7rem] text-ink-soft">{st.note}</div>
                    </div>
                  </div>
                  <span className="font-mono font-medium text-ink-soft">{st.distanceKm} km</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 border border-line bg-surface">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">
              Discovered Destination Stations ({resolution.candidateDestinationStations.length})
            </h3>
            <div className="space-y-2">
              {resolution.candidateDestinationStations.map((st) => (
                <div key={st.station.code} className="flex items-center justify-between p-2.5 rounded-lg border border-line bg-surface-muted text-xs">
                  <div className="flex items-center gap-2">
                    <Train className="h-4 w-4 text-ink-faint" />
                    <div>
                      <span className="font-semibold text-ink">{st.station.name} ({st.station.code})</span>
                      <div className="text-[0.7rem] text-ink-soft">{st.note}</div>
                    </div>
                  </div>
                  <span className="font-mono font-medium text-ink-soft">{st.distanceKm} km</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Rationale & Explanation Banner */}
      {resolution?.explanation && (
        <div className="flex items-start gap-3 rounded-xl bg-brand-soft/60 p-4 border border-brand/20">
          <Sparkles className="h-5 w-5 text-brand shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-brand">Copilot Journey Recommendation Rationale</div>
            <p className="mt-0.5 text-sm text-ink font-medium leading-relaxed">{resolution.explanation}</p>
          </div>
        </div>
      )}

      {/* Candidate Trains List */}
      {resolution && resolution.rankedOptions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">
              Ranked Journey Candidates ({resolution.rankedOptions.length})
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-soft">Sort Priority:</span>
              <button
                onClick={() => setPriority("safest")}
                className={`px-2.5 py-1 text-xs rounded-full border ${priority === "safest" ? "bg-brand text-white border-brand" : "bg-surface text-ink border-line"}`}
              >
                Safest
              </button>
              <button
                onClick={() => setPriority("fastest")}
                className={`px-2.5 py-1 text-xs rounded-full border ${priority === "fastest" ? "bg-brand text-white border-brand" : "bg-surface text-ink border-line"}`}
              >
                Fastest
              </button>
              <button
                onClick={() => setPriority("cheapest")}
                className={`px-2.5 py-1 text-xs rounded-full border ${priority === "cheapest" ? "bg-brand text-white border-brand" : "bg-surface text-ink border-line"}`}
              >
                Cheapest
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {resolution.rankedOptions.map((opt) => {
              const isSelected = selectedOptionId === opt.optionId;
              const totalMins = opt.totalDoorToDoorMins ?? opt.trainDurationMins;
              const totalHours = (totalMins / 60).toFixed(1);

              return (
                <Card
                  key={opt.optionId}
                  onClick={() => setSelectedOptionId(opt.optionId)}
                  className={`p-5 cursor-pointer transition-all border-2 ${
                    isSelected ? "border-brand bg-surface shadow-md" : "border-line bg-surface hover:border-line-strong"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {opt.isPrimary && (
                          <span className="rounded-full bg-confirm-soft px-2.5 py-0.5 text-xs font-bold text-confirm">
                            PRIMARY CHOICE
                          </span>
                        )}
                        {opt.isBackup && (
                          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
                            RECOMMENDED BACKUP
                          </span>
                        )}
                        <span className="text-xs font-mono font-medium text-ink-soft">#{opt.train.number}</span>
                      </div>
                      <h4 className="mt-1 text-lg font-bold text-ink">{opt.train.name}</h4>
                      <p className="text-xs text-ink-soft">
                        Boarding at <strong className="text-ink">{opt.boardingStation.name}</strong> → Arriving at <strong className="text-ink">{opt.arrivalStation.name}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold text-brand">₹{opt.fare}</div>
                      <div className="text-xs text-ink-soft">Class: {opt.travelClass}</div>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-surface-muted p-3 text-xs">
                    <div>
                      <span className="text-ink-faint block">Access Transit</span>
                      <span className="font-semibold text-ink">~{opt.transitToStationMins} mins</span>
                    </div>
                    <div>
                      <span className="text-ink-faint block">Rail Journey</span>
                      <span className="font-semibold text-ink">{(opt.trainDurationMins / 60).toFixed(1)} hrs</span>
                    </div>
                    <div>
                      <span className="text-ink-faint block">Onward Access</span>
                      <span className="font-semibold text-ink">~{opt.onwardAccessMins} mins</span>
                    </div>
                    <div>
                      <span className="text-ink-faint block">Door-to-Door Total</span>
                      <span className="font-semibold text-brand">{totalHours} hrs</span>
                    </div>
                  </div>

                  {/* Reasons & Score Breakdown */}
                  <div className="mt-3 space-y-1">
                    {(opt.journeyScore?.reasons || []).map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <CheckCircle2 className="h-3.5 w-3.5 text-confirm shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Transition to Tatkal Booking Strategy */}
      {selectedOption && (
        <Card className="p-6 border-2 border-brand/30 bg-surface shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-brand">Ready for Tatkal Preparation</div>
            <div className="text-base font-bold text-ink">
              Selected Strategy: {selectedOption.train.name} (#{selectedOption.train.number})
            </div>
            <div className="text-xs text-ink-soft">
              Boarding at {selectedOption.boardingStation.name} · Tatkal Window: 10:00 AM
            </div>
          </div>

          <Button
            size="lg"
            onClick={() => onProceedToBooking?.(selectedOption)}
            className="w-full sm:w-auto gap-2 bg-brand text-white font-semibold shadow-md hover:bg-brand-ink"
          >
            <span>Prepare Tatkal Booking Strategy</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      )}
    </div>
  );
}
