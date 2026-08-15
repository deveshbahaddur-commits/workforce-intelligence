import { useState } from "react";
import {
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import type { KpiItem, KraChecklistItem, KraMetric } from "../api/kraKpiClient.js";
import { colors } from "../theme/colors.styles.js";

const BLANK_METRIC: KraMetric = {
  name: "",
  baseline: 0,
  target: 0,
  unit: "%",
  direction: "down",
  note: "",
  group: "",
  milestone: "",
};

const BLANK_CHECKLIST_ITEM: KraChecklistItem = { name: "", done: false };

const RATING_FIELDS: Array<{ field: keyof KpiItem; label: string }> = [
  { field: "ratingNeedsImprovement", label: "1 - Needs Improvement" },
  { field: "ratingBelowExpectation", label: "2 - Below Expectation" },
  { field: "ratingMeetsExpectation", label: "3 - Meets Expectation" },
  { field: "ratingAboveExpectation", label: "4 - Above Expectation" },
  { field: "ratingExceedsExpectation", label: "5 - Exceeds Expectation" },
];

const COLUMN_COUNT = 13; // Role, KRA, KPI, Goal, Source, 5 ratings, Weight, Details, Remove

function cellInputSx() {
  return {
    "& .MuiOutlinedInput-root": { fontSize: "0.85rem" },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "transparent" },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: colors.gray[300] },
  };
}

interface KraTableRowProps {
  item: KpiItem;
  index: number;
  onChange: (index: number, item: KpiItem) => void;
  onRemove: (index: number) => void;
}

/**
 * One compact, precise table row per KRA — mirrors the original flat KPI
 * table. Everything beyond the original columns (period-variant H1/H2
 * goals, numeric metrics, the optional checklist) lives in an expandable
 * details panel below the row instead of its own always-visible column,
 * so the main table stays scannable.
 */
export default function KraTableRow({ item, index, onChange, onRemove }: KraTableRowProps) {
  const [expanded, setExpanded] = useState(false);

  function set<K extends keyof KpiItem>(field: K, value: KpiItem[K]) {
    onChange(index, { ...item, [field]: value });
  }

  function updateMetric(mIndex: number, field: keyof KraMetric, value: string | number) {
    set(
      "metrics",
      item.metrics.map((m, i) => (i === mIndex ? { ...m, [field]: value } : m)),
    );
  }

  function addMetric() {
    set("metrics", [...item.metrics, { ...BLANK_METRIC }]);
  }

  function removeMetric(mIndex: number) {
    set(
      "metrics",
      item.metrics.filter((_, i) => i !== mIndex),
    );
  }

  function updateChecklistItem(cIndex: number, field: keyof KraChecklistItem, value: string | boolean) {
    set(
      "checklist",
      item.checklist.map((c, i) => (i === cIndex ? { ...c, [field]: value } : c)),
    );
  }

  function addChecklistItem() {
    set("checklist", [...item.checklist, { ...BLANK_CHECKLIST_ITEM }]);
  }

  function removeChecklistItem(cIndex: number) {
    set(
      "checklist",
      item.checklist.filter((_, i) => i !== cIndex),
    );
  }

  return (
    <>
      <TableRow hover>
        <TableCell sx={{ minWidth: 140 }}>
          <TextField variant="outlined" size="small" fullWidth value={item.role} onChange={(e) => set("role", e.target.value)} sx={cellInputSx()} />
        </TableCell>
        <TableCell sx={{ minWidth: 180 }}>
          <TextField variant="outlined" size="small" fullWidth value={item.kra} onChange={(e) => set("kra", e.target.value)} sx={cellInputSx()} />
        </TableCell>
        <TableCell sx={{ minWidth: 200 }}>
          <TextField variant="outlined" size="small" fullWidth value={item.kpiTask} onChange={(e) => set("kpiTask", e.target.value)} sx={cellInputSx()} />
        </TableCell>
        <TableCell sx={{ minWidth: 220 }}>
          <TextField variant="outlined" size="small" fullWidth value={item.goalAnnual} onChange={(e) => set("goalAnnual", e.target.value)} sx={cellInputSx()} />
        </TableCell>
        <TableCell sx={{ minWidth: 160 }}>
          <TextField
            variant="outlined"
            size="small"
            fullWidth
            value={item.sourceOfTracking}
            onChange={(e) => set("sourceOfTracking", e.target.value)}
            sx={cellInputSx()}
          />
        </TableCell>
        {RATING_FIELDS.map((r) => (
          <TableCell key={r.field} sx={{ minWidth: 180 }}>
            <TextField
              variant="outlined"
              size="small"
              fullWidth
              value={item[r.field] as string}
              onChange={(e) => set(r.field, e.target.value as KpiItem[typeof r.field])}
              sx={cellInputSx()}
            />
          </TableCell>
        ))}
        <TableCell sx={{ minWidth: 90 }}>
          <TextField
            type="number"
            variant="outlined"
            size="small"
            fullWidth
            value={item.weightagePercent}
            onChange={(e) => set("weightagePercent", Number(e.target.value) || 0)}
            sx={cellInputSx()}
          />
        </TableCell>
        <TableCell>
          <IconButton size="small" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} title="Details">
            {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <IconButton size="small" onClick={() => onRemove(index)} aria-label="Remove row">
            <CloseIcon fontSize="small" sx={{ color: colors.status.error.main }} />
          </IconButton>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT} sx={{ background: colors.gray[50], p: 0, borderBottom: `1px solid ${colors.gray[200]}` }}>
            <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
              <FormControlLabel
                control={<Checkbox checked={item.defined} onChange={(e) => set("defined", e.target.checked)} />}
                label={
                  <Typography variant="caption2" sx={{ color: colors.text.secondary }}>
                    Target set (unchecked shows as "Pending input" on the scorecard)
                  </Typography>
                }
              />

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2 }}>
                <TextField
                  label="Goal — H1 (defaults to Annual goal if left blank)"
                  value={item.goalH1}
                  onChange={(e) => set("goalH1", e.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
                <TextField
                  label="Goal — H2 (defaults to Annual goal if left blank)"
                  value={item.goalH2}
                  onChange={(e) => set("goalH2", e.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
              </Box>

              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                  <Typography variant="overline" sx={{ color: colors.text.caption, fontSize: "0.8rem" }}>
                    Tracked Metrics (baseline → target)
                  </Typography>
                  <IconButton size="small" onClick={addMetric} sx={{ border: `1px solid ${colors.gray[300]}`, borderRadius: 1 }}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
                {item.metrics.length === 0 && (
                  <Typography variant="caption2" sx={{ color: colors.text.placeholder }}>
                    No numeric metrics for this KRA yet.
                  </Typography>
                )}
                {item.metrics.map((m, i) => (
                  <Box key={i} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <TextField size="small" placeholder="Metric name" value={m.name} onChange={(e) => updateMetric(i, "name", e.target.value)} sx={{ flex: 2, minWidth: 140 }} />
                    <TextField size="small" type="number" placeholder="Baseline" value={m.baseline} onChange={(e) => updateMetric(i, "baseline", Number(e.target.value) || 0)} sx={{ width: 100 }} />
                    <TextField size="small" type="number" placeholder="Target" value={m.target} onChange={(e) => updateMetric(i, "target", Number(e.target.value) || 0)} sx={{ width: 100 }} />
                    <TextField size="small" placeholder="Unit" value={m.unit} onChange={(e) => updateMetric(i, "unit", e.target.value)} sx={{ width: 80 }} />
                    <Select size="small" value={m.direction} onChange={(e) => updateMetric(i, "direction", e.target.value)} sx={{ minWidth: 160 }}>
                      <MenuItem value="down">Lower is better</MenuItem>
                      <MenuItem value="up">Higher is better</MenuItem>
                    </Select>
                    <TextField size="small" placeholder="Note (optional)" value={m.note} onChange={(e) => updateMetric(i, "note", e.target.value)} sx={{ flex: 2, minWidth: 160 }} />
                    <TextField size="small" placeholder="Project (optional)" value={m.group ?? ""} onChange={(e) => updateMetric(i, "group", e.target.value)} sx={{ flex: 1, minWidth: 140 }} />
                    <IconButton size="small" onClick={() => removeMetric(i)} aria-label="Remove metric">
                      <CloseIcon fontSize="small" sx={{ color: colors.status.error.main }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>

              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                  <Typography variant="overline" sx={{ color: colors.text.caption, fontSize: "0.8rem" }}>
                    Checklist (optional — per-unit rollout tracking)
                  </Typography>
                  <IconButton size="small" onClick={addChecklistItem} sx={{ border: `1px solid ${colors.gray[300]}`, borderRadius: 1 }}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
                {item.checklist.length === 0 && (
                  <Typography variant="caption2" sx={{ color: colors.text.placeholder }}>
                    No checklist for this KRA.
                  </Typography>
                )}
                {item.checklist.map((c, i) => (
                  <Box key={i} sx={{ display: "flex", gap: 1.5, mb: 1, alignItems: "center" }}>
                    <TextField
                      size="small"
                      placeholder="Item name, e.g. a department"
                      value={c.name}
                      onChange={(e) => updateChecklistItem(i, "name", e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <FormControlLabel
                      control={<Checkbox checked={c.done} onChange={(e) => updateChecklistItem(i, "done", e.target.checked)} />}
                      label={<Typography variant="caption2">Done</Typography>}
                    />
                    <IconButton size="small" onClick={() => removeChecklistItem(i)} aria-label="Remove checklist item">
                      <CloseIcon fontSize="small" sx={{ color: colors.status.error.main }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
