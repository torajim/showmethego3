import { describe, expect, it } from "vitest";
import { FIVE_GRADE_SHARES, faqIsMine, guide, reformApplies, searchTerms, sortFaq } from "./guide";

describe("guide", () => {
  it("5등급 비율의 합은 100이고 1등급은 10%", () => {
    expect(FIVE_GRADE_SHARES.reduce((a, b) => a + b, 0)).toBe(100);
    expect(FIVE_GRADE_SHARES[0]).toBe(10);
  });

  it("세 제도 카드는 2009년생부터 해당", () => {
    for (const c of guide.reforms) {
      expect(reformApplies(c, 2008)).toBe(false);
      expect(reformApplies(c, 2009)).toBe(true);
      expect(reformApplies(c, 2020)).toBe(true);
    }
  });

  it("재수 질문은 2008~2009년생에게 먼저 보여준다", () => {
    const retake = guide.faq.find((f) => f.id === "retake")!;
    expect(faqIsMine(retake, 2008)).toBe(true);
    expect(faqIsMine(retake, 2012)).toBe(false);
    expect(sortFaq(guide.faq, 2008)[0].id).toBe("retake");
    expect(sortFaq(guide.faq, 2012)[0].id).toBe(guide.faq[0].id);
  });

  it("대상 연도가 없는 질문은 '우리 아이' 표시를 하지 않는다", () => {
    const f = guide.faq.find((x) => x.fromBirthYear === undefined && x.toBirthYear === undefined)!;
    expect(faqIsMine(f, 2012)).toBe(false);
  });

  it("용어는 별칭과 띄어쓰기를 무시하고 찾는다", () => {
    expect(searchTerms(guide.terms, "학생부종합", null)[0].term).toBe("학종");
    expect(searchTerms(guide.terms, "수능 최저", null)[0].term).toBe("수능 최저");
    expect(searchTerms(guide.terms, "", "수능").every((t) => t.group === "수능")).toBe(true);
    expect(searchTerms(guide.terms, "없는말xyz", null)).toEqual([]);
  });
});
