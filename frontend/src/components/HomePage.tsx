import { Box, Grid, Typography } from "@mui/material";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import PageContainer from "../shared/components/PageContainer.js";
import PageHeader from "../shared/components/PageHeader.js";
import PageContent from "../shared/components/PageContent.js";
import AppCard from "../shared/components/AppCard.js";
import { colors } from "../theme/colors.styles.js";
import type { View } from "../shared/components/Sidebar.js";

interface HomePageProps {
  onNavigate: (view: View) => void;
}

const NAV_CARDS: Array<{ view: View; title: string; description: string; icon: JSX.Element; color: string }> = [
  {
    view: "workforce-planning",
    title: "Workforce Planning",
    description:
      "Ask headcount, capacity, and hiring questions — grounded in live HRIS data, guardrail-gated by decision type.",
    icon: <ForumOutlinedIcon />,
    color: colors.status.info.main,
  },
  {
    view: "kra-kpi",
    title: "Set KRA/KPIs for Team",
    description:
      "Pull your direct and indirect reportees and draft KRA/KPIs with an assistant, in the standard org-wide format.",
    icon: <AssignmentTurnedInOutlinedIcon />,
    color: colors.status.success.main,
  },
];

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <PageContainer sx={{ pt: 0 }}>
      <PageHeader title="Workforce Intelligence" caption="For every manager at Recykal" />
      <PageContent>
        <Grid container spacing={2}>
          {NAV_CARDS.map((card) => (
            <Grid item xs={12} sm={6} key={card.view}>
              <AppCard onClick={() => onNavigate(card.view)} sx={{ height: "100%" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: "10px",
                      backgroundColor: `${card.color}18`,
                      color: card.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "999px",
                      backgroundColor: colors.gray[50],
                      color: colors.text.muted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ArrowOutwardIcon fontSize="small" />
                  </Box>
                </Box>
                <Typography variant="subtitle2" sx={{ color: colors.text.primary, mb: 0.5 }}>
                  {card.title}
                </Typography>
                <Typography variant="caption2" sx={{ color: colors.text.muted }}>
                  {card.description}
                </Typography>
              </AppCard>
            </Grid>
          ))}
        </Grid>
      </PageContent>
    </PageContainer>
  );
}
