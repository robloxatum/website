// Nickname rules and how members are named. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { callName, cleanNickname, nicknameError, officerName } from "../src/lib/names.ts";

const alex = { full_name: "Alexander Villagomez", uniqname: "avilla", nickname: "Alex" };

describe("callName", () => {
  it("uses the nickname when set", () => assert.equal(callName(alex), "Alex"));
  it("falls back to the first name", () => assert.equal(callName({ ...alex, nickname: null }), "Alexander"));
  it("falls back to the uniqname", () => assert.equal(callName({ full_name: " ", uniqname: "avilla", nickname: "" }), "avilla"));
});

describe("officerName", () => {
  it("shows the nickname after the full name", () => assert.equal(officerName(alex), "Alexander Villagomez (Alex)"));
  it("is just the full name without a nickname", () =>
    assert.equal(officerName({ ...alex, nickname: null }), "Alexander Villagomez"));
  it("uses the uniqname when there's no name", () =>
    assert.equal(officerName({ full_name: "", uniqname: "avilla", nickname: "Alex" }), "avilla (Alex)"));
});

describe("nickname validation", () => {
  it("trims and collapses spaces", () => assert.equal(cleanNickname("  Big   Al  "), "Big Al"));
  it("allows empty (no nickname)", () => assert.equal(nicknameError(""), null));
  for (const ok of ["Alex", "Zoë", "O'Neil-Smith", "J.R. (Jr)!", "a", "x".repeat(30), "Builder_99"]) {
    it(`accepts ${JSON.stringify(ok)}`, () => assert.equal(nicknameError(ok), null));
  }
  for (const bad of ["x".repeat(31), "<script>", "...", "emoji 😀", "a@b", "tab\there"]) {
    it(`rejects ${JSON.stringify(bad)}`, () => assert.notEqual(nicknameError(bad), null));
  }
});
