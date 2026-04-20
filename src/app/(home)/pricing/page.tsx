"use client";
import { PricingTable } from "@clerk/nextjs";

const Page = () => {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <section className="space-y-6 pt-[16vh] 2xl:pt-48">
        <h1 className="text-center text-xl font-bold md:text-3xl">Pricing</h1>
        <p className="text-muted-foreground text-center text-sm md:text-base">
          Choose the plan that fits your needs.
        </p>
        <PricingTable />
      </section>
    </div>
  );
};

export default Page;
