import { SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-20 bg-gradient-to-b from-background to-muted/20">
        <div className="text-center max-w-4xl mx-auto space-y-8">
          <Badge variant="secondary" className="mb-4">
            AI-Powered YouTube Content Discovery
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-6">
            Chat With Any YouTube Channel&apos;s Content
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Ask questions across any creator&apos;s video library and get instant answers
            with timestamped citations. Turn hours of video into searchable knowledge.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
            <SignUpButton mode="modal">
              <Button size="lg" className="text-lg px-8 py-6">
                Get Started Free
              </Button>
            </SignUpButton>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6" asChild>
              <a href="#how-it-works">Learn More</a>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Four simple steps to unlock your content&apos;s potential
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <CardTitle>Sign Up & Login</CardTitle>
                <CardDescription>
                  Create your account in seconds and get started with any YouTube content
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <CardTitle>Search & Select</CardTitle>
                <CardDescription>
                  Search for any YouTube channel or playlist and choose the videos you want to explore
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <CardTitle>AI Processing</CardTitle>
                <CardDescription>
                  We transcribe and analyze the videos using advanced AI embeddings
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-primary">4</span>
                </div>
                <CardTitle>Ask Questions</CardTitle>
                <CardDescription>
                  Chat with the content and get answers with timestamped citations from the videos
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Why People Love InsightFlow
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">💬</span>
                  Interactive Q&A
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Ask questions about any YouTube content and get answers sourced directly from the videos,
                  complete with timestamps and citations.
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
                  Transform hours of video content into searchable, accessible knowledge.
                  Find exactly what you&apos;re looking for instantly.
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
                  Skip through hours of content and jump straight to the moments that matter with
                  timestamped video links in every answer.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              See It In Action
            </h2>
            <p className="text-xl text-muted-foreground">
              A powerful interface designed for creators and their audiences
            </p>
          </div>

          <div className="space-y-16">
            {/* Video Management */}
            <div className="flex flex-col lg:flex-row gap-8 items-center">
              <div className="lg:w-1/2 space-y-4">
                <Badge>Your Library</Badge>
                <h3 className="text-3xl font-bold">Track Your Transcriptions</h3>
                <p className="text-lg text-muted-foreground">
                  View all the videos you&apos;ve transcribed from any YouTube channel. See processing status,
                  manage your library, and organize content by channel or playlist.
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
            <div className="flex flex-col lg:flex-row-reverse gap-8 items-center">
              <div className="lg:w-1/2 space-y-4">
                <Badge>Easy Discovery</Badge>
                <h3 className="text-3xl font-bold">Search Any YouTube Channel</h3>
                <p className="text-lg text-muted-foreground">
                  Search for any YouTube channel or playlist and select the videos you want to chat with.
                  No channel ownership required.
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
            <div className="flex flex-col lg:flex-row gap-8 items-center">
              <div className="lg:w-1/2 space-y-4">
                <Badge>Smart Chat</Badge>
                <h3 className="text-3xl font-bold">AI-Powered Conversations</h3>
                <p className="text-lg text-muted-foreground">
                  Your audience gets instant answers with citations and timestamped links.
                  Every response is grounded in your actual content.
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
            <div className="flex flex-col lg:flex-row-reverse gap-8 items-center">
              <div className="lg:w-1/2 space-y-4">
                <Badge>Stay Informed</Badge>
                <h3 className="text-3xl font-bold">Real-Time Notifications</h3>
                <p className="text-lg text-muted-foreground">
                  Get notified when transcriptions complete, when errors occur, and stay on top
                  of your content processing.
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
      <section className="py-20 px-4 bg-gradient-to-b from-muted/20 to-background">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">
            Ready to Unlock YouTube&apos;s Knowledge?
          </h2>
          <p className="text-xl text-muted-foreground">
            Start chatting with any YouTube channel&apos;s content today.
            Get instant answers with timestamped citations.
          </p>
          <SignUpButton mode="modal">
            <Button size="lg" className="text-lg px-8 py-6">
              Start Free Today
            </Button>
          </SignUpButton>
        </div>
      </section>
    </div>
  );
}
