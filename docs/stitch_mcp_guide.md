Getting Started
Get up and running and learn a few tips and tricks along the way.

The Stitch MCP takes the power of generating designs from within the Stitch editor and right into your IDE, CLI, or whatever AI tool of choice. You can convert your designs right into your codebase and generate new screens. This gives you programmable and automatable control with Stitch.

Before we begin
Authentication
Before anything else, you’ll need to authenticate with the Stitch MCP. This guide assumes you’ve already authenticated with the Stitch MCP. Check out our Setup and Authentication Guide to get started.

What coding agent to use?
You can use any coding agent of your choice. The Stitch MCP server integrates into coding agents with support for remote HTTP MCP servers.

What we’re building
A Stitch to React component system. Write a prompt and get a well structured set of React components from your Stitch design.

Prompting Stitch
Write a prompt asking to see your Stitch Projects and each screen within that project.

PROMPT

Action
Show me my Stitch projects.
Format
List out each screen under each project and its screen id.
You’ll see a response that looks something like below, although it will vary across tools and model choice.

Terminal window
1. Raffinato Coffee Store App
Created: Jan 14, 2026 • Desktop • Light Mode • Private

Screens (3):

- Home Menu
- Full Menu
- Checkout

Each Stitch Project can contain a series of screens. These screens are what contain the code and the images of your design.

Prompting for fun
The magic of MCP tools is the integration of contextual data retrieval with AI model intelligence. You can ask for understanding of your Stitch projects or instruct the agent to generate new designs and code based upon context on your local machine. Or, you can just ask it a fun question.

PROMPT

For fun
Tell me what my Stitch Projects say about me as a developer.
This one is a lot of fun. If you run it and want to share, give us a shout on Twitter / X. Alright, back to real work.

Prompting for code
Once the agent knows what project or screen you want to work with, you can access the code or the generated image.

PROMPT

Project + Screen
Download the HTML code for the Full Menu screen in the Raffinato project.
Tool Guidance
Use a utility such as curl -L
Action
Create a file named ./tmp/${screen-name}.html with the HTML code.
The HTML file is a complete <html> document with a Tailwind CSS configuration specific to that design.

HTML to other UI frameworks
LLMs excel at converting HTML to many different UI systems. This HTML file serves as a foundation. By prompting an agent not only can you convert HTML to React, Vue, or Handlebars but even UI frameworks outside of the web platform, such as Flutter and Jetpack Compose.

Prompting for images
Just like above, you can ask an agent for the image of your Stitch screen.

PROMPT

Project + Screen
Download the image for the Full Menu screen in the Raffinato project.
Tool Guidance
Use a utility such as curl -L
Action
Create a file named ./tmp/${screen-name}.png containing the image.
Now you’ll have a local copy of your image. However, not much has happened yet. So let’s move this quickly along and convert an entire screen to React components.

Using Agent Skills with Stitch MCP
Many coding agents support the Agent Skill Open Standard. A skill encapsulates an instruction based prompt with a set of resources such as specific tool calls from a MCP server. This skill paradigm is a great fit for generating a React component system from the Stitch MCP.

Creating the React component system
The add-skill library lets you install agent skills to the most commonly used coding agents right from a GitHub URL.

Terminal window
npx add-skill google-labs-code/stitch-skills --skill react:components --global

This skill provides the details to an agent to understand what Stitch tools to use, steps to run, and best practices for separating React components. If you want to check out exactly what it does, see our Stitch Agent Skills GitHub repo.

After it’s installed, you can write a prompt to trigger this skill and let it do the work.

PROMPT

Skill Trigger
Convert the Landing Page screen in the Podcast Project.
The agent will get to work and leave you with a React app running on a Vite local server.