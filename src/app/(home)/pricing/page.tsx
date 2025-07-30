"use client";
import { PricingTable } from "@clerk/nextjs";

const Page = () => {
  return (
    <div className="flex flex-col max-w-3xl mx-auto w-full">
      <section className="space-y-6 pt-[16vh] 2xl:pt-48">
        <h1 className="text-xl md:text-3xl font-bold text-center">Pricing</h1>
        <p className="text-muted-foreground text-center text-sm md:text-base">
          Choose the plan that fits your needs.
        </p>
        <PricingTable />
      </section>
    </div>
  );
};

export default Page;
