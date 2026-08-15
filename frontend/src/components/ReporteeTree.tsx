import { useState } from "react";
import { Box, Collapse, List, ListItemButton, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { ReporteeNode } from "../api/kraKpiClient.js";
import { colors } from "../theme/colors.styles.js";

interface ReporteeTreeProps {
  nodes: ReporteeNode[];
  selectedEmployeeId: string | null;
  onSelect: (employeeId: string) => void;
}

/** Root list: a manager's direct reports, always visible. */
export default function ReporteeTree({ nodes, selectedEmployeeId, onSelect }: ReporteeTreeProps) {
  if (nodes.length === 0) {
    return (
      <Typography variant="caption2" sx={{ color: colors.text.placeholder }}>
        No direct reports.
      </Typography>
    );
  }
  return (
    <List sx={{ p: 0 }}>
      {nodes.map((node) => (
        <ReporteeNodeItem key={node.employeeId} node={node} selectedEmployeeId={selectedEmployeeId} onSelect={onSelect} />
      ))}
    </List>
  );
}

interface ReporteeNodeItemProps {
  node: ReporteeNode;
  selectedEmployeeId: string | null;
  onSelect: (employeeId: string) => void;
}

/**
 * One reportee row, collapsed by default. Indirect reportees (this node's
 * own reports) only render once expanded — each node owns its own expand
 * state, so expanding one branch doesn't affect siblings.
 */
function ReporteeNodeItem({ node, selectedEmployeeId, onSelect }: ReporteeNodeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasIndirectReports = node.reports.length > 0;

  return (
    <Box sx={{ pl: `${(node.depth - 1) * 16}px` }}>
      <ListItemButton
        selected={selectedEmployeeId === node.employeeId}
        onClick={() => onSelect(node.employeeId)}
        sx={{
          borderRadius: 2,
          mb: 0.25,
          gap: 0.5,
          "&.Mui-selected": { backgroundColor: colors.chip.primary.bg },
          "&.Mui-selected:hover": { backgroundColor: colors.chip.primary.bg },
        }}
      >
        {hasIndirectReports ? (
          <Box
            component="span"
            role="button"
            aria-expanded={expanded}
            aria-label={
              expanded ? "Hide indirect reportees" : `Show ${node.reports.length} indirect reportee${node.reports.length === 1 ? "" : "s"}`
            }
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              flexShrink: 0,
              transform: expanded ? "rotate(90deg)" : "none",
              transition: "transform 120ms",
              color: colors.text.muted,
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </Box>
        ) : (
          <Box sx={{ width: 22, flexShrink: 0 }} />
        )}
        <Box sx={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption3" noWrap sx={{ color: colors.text.primary }}>
            {node.name}
          </Typography>
          <Typography variant="caption" noWrap sx={{ color: colors.text.muted, flex: 1 }}>
            {node.role}
          </Typography>
          {hasIndirectReports && (
            <Typography
              variant="caption"
              sx={{
                color: colors.primary.darker,
                backgroundColor: colors.chip.primary.bg,
                px: 0.75,
                borderRadius: "999px",
                whiteSpace: "nowrap",
                fontWeight: 600,
              }}
            >
              {node.reports.length} indirect
            </Typography>
          )}
        </Box>
      </ListItemButton>
      {hasIndirectReports && (
        <Collapse in={expanded}>
          <Box sx={{ borderLeft: `1px solid ${colors.gray[200]}`, ml: "10px" }}>
            {node.reports.map((child) => (
              <ReporteeNodeItem key={child.employeeId} node={child} selectedEmployeeId={selectedEmployeeId} onSelect={onSelect} />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
