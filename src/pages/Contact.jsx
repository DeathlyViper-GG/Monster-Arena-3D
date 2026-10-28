import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const body = encodeURIComponent(
      `Name: ${name}\nReply-to: ${email}\n\n${message}`
    );
    window.location.href = `mailto:support@monster-arenaa.base44.app?subject=Monster%20Arena%20Contact&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to game
        </Link>
        <h1 className="text-4xl font-heading font-bold mt-6 mb-4">Contact Us</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Questions, feedback, or bug reports about Monster Arena? Send us a message and we'll
          get back to you.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Message</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={6} placeholder="How can we help?" />
          </div>
          <Button type="submit" className="w-full">Send Message</Button>
        </form>

        <p className="text-sm text-muted-foreground mt-8">
          Or email us directly at{" "}
          <a className="underline text-foreground hover:opacity-80" href="mailto:support@monster-arenaa.base44.app">
            support@monster-arenaa.base44.app
          </a>
          .
        </p>
      </div>
    </div>
  );
}