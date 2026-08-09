import { execFileSync } from "node:child_process";

const REPOSITORY = process.env.GITHUB_REPOSITORY || "hf7y/chezz";
const [owner, name] = REPOSITORY.split("/");
const RULESET_NAME = "Chezz merge queue";
const dryRun = process.env.CHEZZ_MERGE_QUEUE_DRY_RUN === "1";

function ghToken() {
  return execFileSync("gh", ["auth", "token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const token = process.env.GH_TOKEN || ghToken();
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
};

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload;
}

async function graphql(query, variables) {
  return request("https://api.github.com/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
  });
}

const existing = await request(`https://api.github.com/repos/${REPOSITORY}/rulesets`);
if (existing.some((ruleset) => ruleset.name === RULESET_NAME)) {
  console.log(`${RULESET_NAME} already exists; leaving it unchanged.`);
  process.exit(0);
}

const repository = await graphql(
  "query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { id } }",
  { owner, name }
);
if (repository.errors) throw new Error(JSON.stringify(repository.errors));

const input = {
  sourceId: repository.data.repository.id,
  name: RULESET_NAME,
  target: "BRANCH",
  enforcement: "ACTIVE",
  conditions: { refName: { include: ["refs/heads/main"], exclude: [] } },
  rules: [
    {
      type: "PULL_REQUEST",
      parameters: {
        pullRequest: {
          dismissStaleReviewsOnPush: false,
          requireCodeOwnerReview: false,
          requireLastPushApproval: false,
          requiredApprovingReviewCount: 0,
          requiredReviewThreadResolution: false,
        },
      },
    },
    {
      type: "REQUIRED_STATUS_CHECKS",
      parameters: {
        requiredStatusChecks: {
          doNotEnforceOnCreate: false,
          strictRequiredStatusChecksPolicy: true,
          requiredStatusChecks: [{ context: "Test / gate" }],
        },
      },
    },
    {
      type: "MERGE_QUEUE",
      parameters: {
        mergeQueue: {
          checkResponseTimeoutMinutes: 30,
          groupingStrategy: "ALLGREEN",
          maxEntriesToBuild: 3,
          maxEntriesToMerge: 1,
          mergeMethod: "SQUASH",
          minEntriesToMerge: 1,
          minEntriesToMergeWaitMinutes: 0,
        },
      },
    },
  ],
};

if (dryRun) {
  console.log(`Dry run: would create ${RULESET_NAME} for ${REPOSITORY}.`);
  process.exit(0);
}

const created = await graphql(
  "mutation($input: CreateRepositoryRulesetInput!) { createRepositoryRuleset(input: $input) { repositoryRuleset { id name enforcement } } }",
  { input }
);
if (created.errors) throw new Error(JSON.stringify(created.errors));

const ruleset = created.data.createRepositoryRuleset.repositoryRuleset;
console.log(`Created ${ruleset.name} (${ruleset.id}, ${ruleset.enforcement}).`);
