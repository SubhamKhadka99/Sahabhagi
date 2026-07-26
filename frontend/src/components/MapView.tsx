import L from "leaflet";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { Report } from "../lib/api";

// Fix default Leaflet marker icon broken by Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Cluster-based heatmap weight calculation ──────────────────────────────
// Grid cell ≈ 78m at Kathmandu latitude (0.0007° ≈ 78m)
// Contribution per report = base(status) * max(1 + voteScore, 0.2)
// so community upvotes raise a cluster's heat and downvotes cool it —
// direct citizen validation controls the map's urgency signal.

const GRID = 0.0007;
const MAX_COUNT = 15; // 15+ weighted reports = full red hotspot

function buildHeatClusters(reports: Report[]): [number, number, number][] {
  if (!reports.length) return [];

  const grid = new Map<string, { sumLat: number; sumLng: number; count: number }>();

  for (const r of reports) {
    const gx = Math.round(r.lat / GRID);
    const gy = Math.round(r.lng / GRID);
    const key = `${gx}:${gy}`;
    const baseWeight = r.status === "Resolved" ? 0.1 : 1.0;
    const netWeight = Math.max(1 + (r.voteScore ?? 0), 0.2);
    const contribution = baseWeight * netWeight;
    const cell = grid.get(key);
    if (cell) {
      cell.sumLat += r.lat;
      cell.sumLng += r.lng;
      cell.count += contribution;
    } else {
      grid.set(key, { sumLat: r.lat, sumLng: r.lng, count: contribution });
    }
  }

  return Array.from(grid.values()).map(({ sumLat, sumLng, count }): [number, number, number] => {
    const n = Math.round(count) || 1;
    return [sumLat / n, sumLng / n, Math.min(count / MAX_COUNT, 1.0)];
  });
}

// ── HeatLayer component ───────────────────────────────────────────────────
function HeatLayer({ reports }: { reports: Report[] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    const points = buildHeatClusters(reports);
    if (!points.length) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layerRef.current = (L as any).heatLayer(points, {
      radius: 40,
      blur: 30,
      maxZoom: 18,
      minOpacity: 0.25,
      gradient: {
        0.00: "#3b82f6",
        0.15: "#06b6d4",
        0.35: "#84cc16",
        0.55: "#eab308",
        0.75: "#f97316",
        0.90: "#ef4444",
        1.00: "#dc2626",
      },
    });
    (layerRef.current as L.Layer).addTo(map);

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [map, reports]);

  return null;
}

// ── Status → marker colour ────────────────────────────────────────────────
const STATUS_COLORS: Record<Report["status"], string> = {
  Reported:     "#ef4444",
  Acknowledged: "#00B4D8",
  Dispatched:   "#f59e0b",
  Resolved:     "#10b981",
};

function statusLabel(s: Report["status"]) {
  return { Reported: "🔴", Acknowledged: "🔵", Dispatched: "🟡", Resolved: "🟢" }[s];
}

// ── Props ─────────────────────────────────────────────────────────────────
interface MapViewProps {
  reports: Report[];
  center?: [number, number];
  zoom?: number;
  showHeatmap?: boolean;
  className?: string;
  /** Pass to enable an "I'm facing this too" (upvote) button inside map popups */
  onUpvote?: (reportId: string) => void;
  /** Pass to enable a "View full details" button inside map popups */
  onSelectReport?: (reportId: string) => void;
  currentUserId?: string;
}

export default function MapView({
  reports,
  center = [27.7005, 85.3123], // Ward 10 centroid
  zoom = 14,
  showHeatmap = false,
  className = "h-full w-full",
  onUpvote,
  onSelectReport,
  currentUserId,
}: MapViewProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={className}
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {showHeatmap && <HeatLayer reports={reports} />}

      {reports.map(report => (
        <CircleMarker
          key={report.id}
          center={[report.lat, report.lng]}
          radius={7}
          pathOptions={{
            color: STATUS_COLORS[report.status],
            fillColor: STATUS_COLORS[report.status],
            fillOpacity: 0.8,
            weight: 2,
          }}
        >
          <Popup maxWidth={230}>
            <div className="font-sans">
              <div className="flex items-center gap-1 mb-1">
                <span>{statusLabel(report.status)}</span>
                <span className="font-semibold text-[#0A192F]">{report.type}</span>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                {report.reporterName} · {report.status}
              </p>
              {report.description && (
                <p className="text-xs text-gray-600 mb-2">{report.description}</p>
              )}
              {report.imageUrl ? (
                <img
                  src={report.imageUrl}
                  alt={report.type}
                  className="w-full h-28 object-cover rounded-lg mb-2"
                />
              ) : (
                <p className="text-xs text-gray-400 mb-2">No photo attached</p>
              )}
              {report.officerNote && (
                <p className="text-xs text-cyan-600 mb-2 font-medium">
                  Officer: {report.officerNote}
                </p>
              )}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-gray-600">
                  👍 {report.upvoteCount} · 👎 {report.downvoteCount}
                </span>
                <span className="text-xs font-bold text-[#0A192F]">
                  Net {report.voteScore > 0 ? `+${report.voteScore}` : report.voteScore}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {report.status === "Resolved" && (
                  <span className="flex-1 text-center text-[11px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1.5">
                    ✅ Resolved — closed to voting
                  </span>
                )}
                {onUpvote && report.status !== "Resolved" && !report.upvoterIds?.includes(currentUserId ?? "") && (
                  <button
                    onClick={() => onUpvote(report.id)}
                    className="flex-1 text-xs font-semibold bg-[#00B4D8] text-white rounded-full px-2.5 py-1.5 hover:bg-cyan-500 transition"
                  >
                    + Me too
                  </button>
                )}
                {onSelectReport && (
                  <button
                    onClick={() => onSelectReport(report.id)}
                    className="flex-1 text-xs font-semibold bg-[#0A192F] text-white rounded-full px-2.5 py-1.5 hover:bg-[#1a3a6b] transition"
                  >
                    View Details
                  </button>
                )}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
