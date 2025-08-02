"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import PurchaseVideoTable from "../PurchaseVideoTable/PurchaseVideoTable";

export const VideoSearch = () => {
  const [channelHandle, setChannelHandle] = useState("");
  const [submittedHandle, setSubmittedHandle] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelHandle.trim()) {
      setSubmittedHandle(channelHandle.trim());
      setIsSubmitted(true);
    }
  };

  const handleReset = () => {
    setChannelHandle("");
    setSubmittedHandle("");
    setIsSubmitted(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search YouTube Channel</CardTitle>
          <CardDescription>
            Enter a YouTube channel handle to view and select videos for transcription.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="channelHandle">YouTube Channel Handle</Label>
              <Input
                id="channelHandle"
                type="text"
                placeholder="@channelname"
                value={channelHandle}
                onChange={(e) => setChannelHandle(e.target.value)}
                disabled={isSubmitted}
              />
              <p className="text-sm text-gray-600">
                Enter the channel handle (e.g., @channelname)
              </p>
            </div>
            <div className="flex space-x-2">
              {!isSubmitted ? (
                <Button type="submit" disabled={!channelHandle.trim()}>
                  Search Videos
                </Button>
              ) : (
                <Button type="button" onClick={handleReset} variant="outline">
                  Search Different Channel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {isSubmitted && (
        <PurchaseVideoTable channelHandle={submittedHandle} />
      )}
    </div>
  );
};
