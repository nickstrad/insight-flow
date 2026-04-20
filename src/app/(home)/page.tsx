import { SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="from-background to-muted/20 flex min-h-[80vh] flex-col items-center justify-center bg-gradient-to-b px-4 py-20">
        <div className="mx-auto max-w-4xl space-y-8 text-center">
          <Badge variant="secondary" className="mb-4">
            AI-Powered YouTube Content Discovery
          </Badge>

          <h1 className="from-primary to-primary/60 mb-6 bg-gradient-to-r bg-clip-text text-5xl font-bold text-transparent md:text-7xl">
            Chat With Any YouTube Channel&apos;s Content
          </h1>

          <p className="text-muted-foreground mx-auto max-w-3xl text-xl md:text-2xl">
            Ask questions across any creator&apos;s video library and get
            instant answers with timestamped citations. Turn hours of video into
            searchable knowledge.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 pt-6 sm:flex-row">
            <SignUpButton mode="modal">
              <Button size="lg" className="px-8 py-6 text-lg">
                Get Started Free
              </Button>
            </SignUpButton>
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg"
              asChild
            >
              <a href="#how-it-works">Learn More</a>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-background px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold md:text-5xl">
              How It Works
            </h2>
            <p className="text-muted-foreground text-xl">
              Four simple steps to unlock your content&apos;s potential
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-primary text-2xl font-bold">1</span>
                </div>
                <CardTitle>Sign Up & Login</CardTitle>
                <CardDescription>
                  Create your account in seconds and get started with any
                  YouTube content
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-primary text-2xl font-bold">2</span>
                </div>
                <CardTitle>Search & Select</CardTitle>
                <CardDescription>
                  Search for any YouTube channel or playlist and choose the
                  videos you want to explore
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-primary text-2xl font-bold">3</span>
                </div>
                <CardTitle>AI Processing</CardTitle>
                <CardDescription>
                  We transcribe and analyze the videos using advanced AI
                  embeddings
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-primary text-2xl font-bold">4</span>
                </div>
                <CardTitle>Ask Questions</CardTitle>
                <CardDescription>
                  Chat with the content and get answers with timestamped
                  citations from the videos
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/20 px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold md:text-5xl">
              Why People Love InsightFlow
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">💬</span>
                  Interactive Q&A
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Ask questions about any YouTube content and get answers
                  sourced directly from the videos, complete with timestamps and
                  citations.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🔍</span>
                  Searchable Knowledge
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Transform hours of video content into searchable, accessible
                  knowledge. Find exactly what you&apos;re looking for
                  instantly.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  Save Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Skip through hours of content and jump straight to the moments
                  that matter with timestamped video links in every answer.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="bg-background px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold md:text-5xl">
              See It In Action
            </h2>
            <p className="text-muted-foreground text-xl">
              A powerful interface designed for creators and their audiences
            </p>
          </div>

          <div className="space-y-16">
            {/* Video Management */}
            <div className="flex flex-col items-center gap-8 lg:flex-row">
              <div className="space-y-4 lg:w-1/2">
                <Badge>Your Library</Badge>
                <h3 className="text-3xl font-bold">
                  Track Your Transcriptions
                </h3>
                <p className="text-muted-foreground text-lg">
                  View all the videos you&apos;ve transcribed from any YouTube
                  channel. See processing status, manage your library, and
                  organize content by channel or playlist.
                </p>
              </div>
              <div className="lg:w-1/2">
                <Image
                  src="/screenshots/my_videos_view.png"
                  alt="Transcribed videos management view"
                  width={800}
                  height={600}
                  className="rounded-lg border shadow-2xl"
                />
              </div>
            </div>

            {/* Video Selection */}
            <div className="flex flex-col items-center gap-8 lg:flex-row-reverse">
              <div className="space-y-4 lg:w-1/2">
                <Badge>Easy Discovery</Badge>
                <h3 className="text-3xl font-bold">
                  Search Any YouTube Channel
                </h3>
                <p className="text-muted-foreground text-lg">
                  Search for any YouTube channel or playlist and select the
                  videos you want to chat with. No channel ownership required.
                </p>
              </div>
              <div className="lg:w-1/2">
                <Image
                  src="/screenshots/video_selection_view.png"
                  alt="Video selection interface"
                  width={800}
                  height={600}
                  className="rounded-lg border shadow-2xl"
                />
              </div>
            </div>

            {/* Chat Interface */}
            <div className="flex flex-col items-center gap-8 lg:flex-row">
              <div className="space-y-4 lg:w-1/2">
                <Badge>Smart Chat</Badge>
                <h3 className="text-3xl font-bold">AI-Powered Conversations</h3>
                <p className="text-muted-foreground text-lg">
                  Your audience gets instant answers with citations and
                  timestamped links. Every response is grounded in your actual
                  content.
                </p>
              </div>
              <div className="lg:w-1/2">
                <Image
                  src="/screenshots/chat_ux.png"
                  alt="Chat interface with AI responses"
                  width={800}
                  height={600}
                  className="rounded-lg border shadow-2xl"
                />
              </div>
            </div>

            {/* Notifications */}
            <div className="flex flex-col items-center gap-8 lg:flex-row-reverse">
              <div className="space-y-4 lg:w-1/2">
                <Badge>Stay Informed</Badge>
                <h3 className="text-3xl font-bold">Real-Time Notifications</h3>
                <p className="text-muted-foreground text-lg">
                  Get notified when transcriptions complete, when errors occur,
                  and stay on top of your content processing.
                </p>
              </div>
              <div className="lg:w-1/2">
                <Image
                  src="/screenshots/notifications_view.png"
                  alt="Notifications panel"
                  width={800}
                  height={600}
                  className="rounded-lg border shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="from-muted/20 to-background bg-gradient-to-b px-4 py-20">
        <div className="mx-auto max-w-4xl space-y-8 text-center">
          <h2 className="text-4xl font-bold md:text-5xl">
            Ready to Unlock YouTube&apos;s Knowledge?
          </h2>
          <p className="text-muted-foreground text-xl">
            Start chatting with any YouTube channel&apos;s content today. Get
            instant answers with timestamped citations.
          </p>
          <SignUpButton mode="modal">
            <Button size="lg" className="px-8 py-6 text-lg">
              Start Free Today
            </Button>
          </SignUpButton>
        </div>
      </section>
    </div>
  );
}
