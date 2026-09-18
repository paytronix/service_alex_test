import { describe, expect, it } from "vitest";
import { buildXlsx } from "../src/utils/xlsx";

describe("buildXlsx", () => {
  it("writes escaped strings, numeric cells, and columns beyond Z", () => {
    const header = Array.from({ length: 27 }, (_, index) => `Header ${index + 1}`);
    const row = Array.from<string | number>({ length: 27 }).fill("");
    row[0] = `<&>"'`;
    row[1] = 42;
    row[26] = "AA value";

    const workbook = buildXlsx({
      name: "Report [2026] / March",
      header,
      rows: [row],
    });
    const contents = workbook.toString("utf8");

    expect(workbook.subarray(0, 4)).toEqual(Buffer.from("PK\x03\x04"));
    expect(contents).toContain("xl/worksheets/sheet1.xml");
    expect(contents).toContain("&lt;&amp;&gt;&quot;&apos;");
    expect(contents).toContain('<c r="B2"><v>42</v></c>');
    expect(contents).toContain('<c r="AA2" t="inlineStr"><is><t>AA value</t>');
    expect(workbook.subarray(-22, -18)).toEqual(Buffer.from("PK\x05\x06"));
  });
});
