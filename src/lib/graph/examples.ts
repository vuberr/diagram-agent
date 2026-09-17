export interface Example {
  id: string;
  title: string;
  blurb: string;
  description: string;
}

/**
 * Example prompts. Clicking one populates the input textarea — these are
 * inputs to the AI pipeline, never pre-baked outputs.
 */
export const EXAMPLES: Example[] = [
  {
    id: "web-app",
    title: "Web Application",
    blurb: "Three-tier browser → server → database stack",
    description:
      "A customer accesses the web application through the internet. The web server communicates with an API server. The API server reads and writes data to a PostgreSQL database. Administrators can access the application through a VPN.",
  },
  {
    id: "cloud-arch",
    title: "Cloud Architecture",
    blurb: "Load balancer, autoscaling and CDN tier",
    description:
      "Users connect to a load balancer. The load balancer distributes requests between two application servers. Both application servers communicate with a MySQL database. A Redis cache sits in front of the database and a CDN serves static assets to users.",
  },
  {
    id: "enterprise-network",
    title: "Enterprise Network",
    blurb: "Firewalls, VPN and internal zones",
    description:
      "Employees connect to the corporate network through a VPN. The firewall protects the internal network from the internet. Inside the network there is a file server, a print server and a domain controller. Remote contractors use a jump server to reach internal systems.",
  },
  {
    id: "e-commerce",
    title: "E-Commerce System",
    blurb: "Orders, payments and inventory services",
    description:
      "Customers browse products through the storefront web app. The storefront sends orders to an order service. The order service charges payments through a payment gateway and reserves stock in the inventory service. The inventory service updates a product database and publishes events to a message queue that a notification service consumes.",
  },
  {
    id: "auth-flow",
    title: "Authentication Flow",
    blurb: "OAuth provider, token issuance and session validation",
    description:
      "A user signs in through the login page. The login page redirects to an OAuth provider. The OAuth provider returns an authorization code to the callback endpoint. The callback endpoint exchanges the code for tokens at the identity service. The identity service stores sessions in Redis and the application validates every request against it.",
  },
  {
    id: "cicd-pipeline",
    title: "CI/CD Pipeline",
    blurb: "Git push to production deploy",
    description:
      "A developer pushes code to GitHub. GitHub triggers a webhook to the CI server. The CI server runs tests in a container and builds a Docker image. The image is pushed to a container registry. A deployment controller pulls the image and rolls it out to the Kubernetes cluster. Prometheus monitors the cluster.",
  },
];
