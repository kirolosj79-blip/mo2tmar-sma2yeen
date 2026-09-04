"use client";

import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, type Plugin } from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

// بلجن بسيط بيرسم الرقم فوق كل عمود مباشرة — من غير الحاجة لمكتبة إضافية
const valueLabelsPlugin: Plugin<"bar"> = {
  id: "valueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (value === null || value === undefined) return;
        ctx.save();
        ctx.fillStyle = "#E8ECF4";
        ctx.font = "bold 12px Inter, Tajawal, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(value), bar.x, bar.y - 6);
        ctx.restore();
      });
    });
  },
};

export default function BarChart({
  labels,
  values,
  colors,
}: {
  labels: string[];
  values: number[];
  colors: string[];
}) {
  return (
    <Bar
      data={{
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderRadius: 8, maxBarThickness: 64 }],
      }}
      options={{
        maintainAspectRatio: false,
        layout: { padding: { top: 22 } },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#8B96AE", font: { size: 13, weight: "bold" } }, grid: { display: false } },
          y: { ticks: { color: "#8B96AE" }, grid: { color: "#243050" } },
        },
      }}
      plugins={[valueLabelsPlugin]}
    />
  );
}
