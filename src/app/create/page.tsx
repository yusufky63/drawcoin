"use client";

import dynamic from "next/dynamic";

// Create component'ini dynamic import ile yükle
const CreatePage = dynamic(() => import("../../components/create/CreatePage"), {
  ssr: true,
});

export default function CreateRoute() {
  return (
    <div className="min-h-screen bg-art-gray-50 pb-20 md:pb-0">
      <CreatePage />
    </div>
  );
}
