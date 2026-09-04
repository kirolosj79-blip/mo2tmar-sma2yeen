"use client";

import { Chart as ChartJS, ArcElement, Tooltip, Legend, type Plugin } from "chart.js";
import { Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

// بلجن بسيط بيرسم الرقم جوه كل شريحة مباشرة — من غير الحاجة لمكتبة إضافية
const sliceValuePlugin: Plugin<"pie"> = {
  id: "sliceValues",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((arc, index) => {
        const value = dataset.data[index];
        if (!value) return;
        // @ts-expect-error - getCenterPoint موجودة فعليًا على ArcElement وقت الرسم
        const pos = arc.getCenterPoint();
        ctx.save();
        ctx.fillStyle = "#0B1120";
        ctx.font = "bold 12px Inter, Tajawal, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(value), pos.x, pos.y);
        ctx.restore();
      });
    });
  },
};

export default function PieChart({
  labels,
  values,
  colors,
}: {
  labels: string[];
  values: number[];
  colors: string[];
}) {
  return (
    <Pie
      data={{
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderColor: "var(--surface)", borderWidth: 2 }],
      }}
      options={{
        plugins: {
          legend: { position: "bottom", labels: { color: "#8B96AE", boxWidth: 10, font: { size: 11 } } },
        },
      }}
      plugins={[sliceValuePlugin]}
    />
  );
}
