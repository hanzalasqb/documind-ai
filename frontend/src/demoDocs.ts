/** Sample documents preloaded in the live demo. All companies and policies are fictional. */
export const SAMPLE_DOCS: { filename: string; text: string }[] = [
  {
    filename: "northwind-remote-work-policy.md",
    text: `# Northwind Labs — Remote Work Policy (sample)

## Eligibility
All full-time employees who have completed their 90-day probation period may work remotely up to four days per week. Interns and contractors need written approval from their team lead.

## Core hours
Remote employees must be available during core hours from 11:00 to 16:00 Pakistan Standard Time, Monday to Friday. Meetings should be scheduled inside core hours whenever possible.

## Equipment and allowance
Northwind provides a laptop, a monitor and a headset to every remote employee. Employees receive a monthly internet allowance of PKR 6,000, paid with the salary. Equipment must be returned within 14 days of leaving the company.

## Security
Company data may only be accessed on company laptops with full-disk encryption enabled. Public Wi-Fi must be used together with the company VPN. Lost or stolen devices must be reported to IT within 24 hours.

## Travel and working abroad
Employees may work from another country for up to 30 days per calendar year after approval from HR, so that tax and data-protection rules can be checked first.`,
  },
  {
    filename: "documind-user-guide.md",
    text: `# DocuMind AI — User Guide

## Uploading documents
Click Upload to add PDF, TXT or Markdown files. Each file is split into overlapping chunks of about 900 characters with 150 characters of overlap, so sentences that cross a boundary are not lost.

## Asking questions
Type a question and press Send. DocuMind retrieves the four most relevant chunks and answers only from them. Every claim is followed by a citation such as [1] that points to the source chunk, and you can expand the sources under each answer to check the original text.

## Searching specific files
Click one or more documents in the sidebar to limit the search to those files. Click them again to search everything.

## Privacy
In the full app, documents are stored by your own backend. You can run the whole stack locally with Ollama so no text leaves your machine. In this live demo, files you upload stay in your browser tab and disappear when you reload the page.

## Models
The backend works with any OpenAI-compatible API, including OpenAI, Groq, Together and a local Ollama server. Set the base URL, chat model and embedding model in the backend .env file.`,
  },
  {
    filename: "skyhost-pricing-faq.md",
    text: `# SkyHost Cloud — Pricing FAQ (sample)

## What plans are available?
SkyHost offers three plans. Starter costs $5 per month and includes 1 vCPU, 1 GB RAM and 25 GB SSD storage. Pro costs $20 per month with 2 vCPU, 4 GB RAM and 80 GB storage. Business costs $60 per month with 4 vCPU, 16 GB RAM, 200 GB storage and priority support.

## Is there a free trial?
New accounts get a 14-day free trial of the Pro plan. No credit card is needed to start the trial.

## How does billing work?
Servers are billed hourly up to the monthly price cap. Bandwidth above 2 TB per month costs $0.01 per GB.

## Can I get a refund?
Annual plans can be refunded in full within 30 days of purchase. Monthly plans are not refundable, but you can cancel at any time and the server keeps running until the end of the billing period.

## Do you offer discounts?
Paying annually saves 20 percent. Registered students and non-profits receive an extra 15 percent discount after verification.`,
  },
];
