/**
 * exportDocx.js
 * -------------
 * Native Microsoft Word (.docx) report exporter for DataMind.
 *
 * Implements:
 * - A4 portrait with 2 cm margins and real Word heading styles (H1 16pt #1B4324, H2 13pt #1B4324).
 * - Cover page (own section, tier-based DataMind logo top center for Free, none for Pro).
 * - Real Word Table of Contents (TOC) with updateFields on open.
 * - Native formatted tables for Correlation pairs, Correlation matrix, and Data Dictionary.
 * - Embedded high-resolution chart figures with aspect ratio preservation and captions.
 * - Professional body footers with page numbering (Page X / Y) and tier-based branding.
 */

/**
 * Converts a base64 Data URL to a Uint8Array for docx ImageRun.
 */
function dataUrlToUint8Array(dataUrl) {
  if (!dataUrl) return new Uint8Array();
  const base64 = dataUrl.split(",")[1] || dataUrl;
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fetch image asset as Uint8Array with dimensions.
 */
async function fetchImageBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Get image natural dimensions
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 200, height: img.naturalHeight || 60 });
      img.onerror = () => resolve({ width: 200, height: 60 });
      img.src = URL.createObjectURL(blob);
    });

    return { data, ...dims };
  } catch (err) {
    console.warn(`Could not load image from ${url}:`, err);
    return null;
  }
}

/**
 * Clean hex color (ensure no '#' prefix, exactly 6 characters).
 */
function cleanHex(colorStr, fallback = "1B4324") {
  if (!colorStr) return fallback;
  const str = String(colorStr).replace("#", "").trim();
  if (str.length === 6) return str.toUpperCase();
  if (str.length === 3) return str.split("").map((c) => c + c).join("").toUpperCase();
  return fallback;
}

/**
 * Export document model to a native .docx file and trigger browser download.
 */
export async function exportReportToDocx({
  documentModel,
  charts = [],
  statsMap = {},
  settings = {},
  summary = {},
  palette = null,
  plan = "free",
  lang = "vi",
  t = (k) => k,
  onProgress = null,
}) {
  if (!documentModel) {
    throw new Error("Missing documentModel for DOCX export");
  }

  // 1. Dynamic imports of docx, chartImages, and file-saver
  const docx = await import("docx");
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    PageNumber,
    TableOfContents,
    Footer,
    PageBreak,
  } = docx;
  const { captureChartImages } = await import("./chartImages");
  const { saveAs } = await import("file-saver");

  // UI Theme Green constant #1B4324 used for cover title, headings, and TOC title
  const UI_GREEN = "1B4324";
  const resolvedPlan = String(plan || documentModel.meta?.plan || "free").toLowerCase();
  const showBranding = resolvedPlan !== "pro";

  console.debug("[DOCX Export] Exporting document with plan:", resolvedPlan, "showBranding (logos enabled):", showBranding);

  // 2. Capture required chart images (excluding native heatmap & count grid tables)
  const figureBlocks = (documentModel.blocks || []).filter((b) => b.type === "figure");
  const chartIds = figureBlocks.map((b) => b.chartId);
  const figureWidths = {};
  figureBlocks.forEach((b) => {
    figureWidths[b.chartId] = b.width || "full";
  });

  let capturedImages = {};
  if (chartIds.length > 0) {
    capturedImages = await captureChartImages(chartIds, {
      charts,
      statsMap,
      settings,
      summary,
      palette,
      lang,
      t,
      onProgress,
      figureWidths,
    });
  }

  // 3. Load branding assets if Free plan
  let coverLogo = null;
  let footerLogo = null;

  if (showBranding) {
    coverLogo =
      (await fetchImageBuffer("/logo-full.png")) ||
      (await fetchImageBuffer("/logo.png")) ||
      (await fetchImageBuffer("/logo_icon.png"));
    footerLogo =
      (await fetchImageBuffer("/logo_icon.png")) ||
      (await fetchImageBuffer("/logo.png")) ||
      coverLogo;
  }

  const marginTwips = 1134; // 2 cm in twips (20mm)

  // Footer for all document pages (Page X / Y right-aligned; logo + brand on left for Free tier)
  const footerLeftChildren = [];
  if (showBranding) {
    if (footerLogo) {
      footerLeftChildren.push(
        new ImageRun({
          data: footerLogo.data,
          transformation: { width: 19, height: 19 },
        }),
        new TextRun({ text: "  " })
      );
    }
    footerLeftChildren.push(
      new TextRun({
        text: lang === "en" ? "Created with DataMind" : "Tạo bằng DataMind",
        font: "Arial",
        size: 18, // 9pt
        color: "8C948D",
      })
    );
  }

  const footerRightChildren = [
    new TextRun({
      text: lang === "en" ? "Page " : "Trang ",
      font: "Arial",
      size: 18,
      color: "8C948D",
    }),
    PageNumber.CURRENT,
    new TextRun({
      text: " / ",
      font: "Arial",
      size: 18,
      color: "8C948D",
    }),
    PageNumber.TOTAL_PAGES,
  ];

  const footerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                children: footerLeftChildren,
                alignment: AlignmentType.LEFT,
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                children: footerRightChildren,
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const bodyFooter = new Footer({
    children: [footerTable],
  });

  // Single continuous document children list
  const docChildren = [];

  // ── 1. Cover Block on Page 1 (if enabled) ────────────────────────
  if (documentModel.cover) {
    const cover = documentModel.cover;
    let hasLogo = false;

    // Top logo for Free tier (~3 cm wide -> ~113 px)
    if (showBranding && coverLogo) {
      const logoWidth = 113; // 3 cm * 37.8 ≈ 113 px
      const logoHeight = Math.round(logoWidth * (coverLogo.height / coverLogo.width));
      docChildren.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: coverLogo.data,
              transformation: { width: logoWidth, height: logoHeight },
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 240 }, // 12pt after
        })
      );
      hasLogo = true;
    }

    // Title: 22pt bold UI theme green #1B4324
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: cover.title || (lang === "en" ? "Data Analysis Report" : "Báo cáo phân tích dữ liệu"),
            font: "Arial",
            size: 44, // 22pt
            bold: true,
            color: UI_GREEN,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: hasLogo ? 240 : 480, after: 240 }, // 24pt above if no logo, 12pt after
      })
    );

    // One line "Tập dữ liệu: <file>"
    if (cover.fileName) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${lang === "en" ? "Dataset: " : "Tập dữ liệu: "}${cover.fileName}`,
              font: "Arial",
              size: 22, // 11pt
              italics: true,
              color: "626C65",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 240 }, // 12pt after
        })
      );
    }

    // Small 2-column borderless info table with ONLY filled fields
    const infoItems = [];
    if (cover.author && cover.author.trim()) {
      infoItems.push({
        label: lang === "en" ? "Author:" : "Người thực hiện:",
        value: cover.author.trim(),
      });
    }
    if (cover.organization && cover.organization.trim()) {
      infoItems.push({
        label: lang === "en" ? "Organization / Class:" : "Đơn vị / Lớp:",
        value: cover.organization.trim(),
      });
    }
    if (cover.date && cover.date.trim()) {
      infoItems.push({
        label: lang === "en" ? "Date:" : "Ngày:",
        value: cover.date.trim(),
      });
    }

    // Quy mô ("232 dòng × 64 cột")
    const rowsFormatted = Number(cover.rows ?? documentModel.meta?.rows ?? 0).toLocaleString(lang === "en" ? "en-US" : "vi-VN");
    const colsFormatted = cover.cols ?? documentModel.meta?.cols ?? 0;
    const scaleValue = lang === "en"
      ? `${rowsFormatted} rows × ${colsFormatted} columns`
      : `${rowsFormatted} dòng × ${colsFormatted} cột`;
    infoItems.push({
      label: lang === "en" ? "Scale:" : "Quy mô:",
      value: scaleValue,
    });

    const infoTableRows = infoItems.map((item) => {
      return new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 38, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.label,
                    font: "Arial",
                    size: 20, // 10pt
                    bold: true,
                    color: "626C65",
                  }),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { before: 30, after: 30 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 62, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.value,
                    font: "Arial",
                    size: 20, // 10pt
                    color: "121A14",
                  }),
                ],
                alignment: AlignmentType.LEFT,
                spacing: { before: 30, after: 30 },
              }),
            ],
          }),
        ],
      });
    });

    docChildren.push(
      new Table({
        width: { size: 70, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER,
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: infoTableRows,
      })
    );
  }

  // ── 2. Table of Contents (if enabled) ────────────────────────────
  if (documentModel.toc) {
    // "Mục lục" title: plain paragraph, 14pt bold UI theme green #1B4324 (NOT heading style!)
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: lang === "en" ? "Table of Contents" : "Mục lục",
            font: "Arial",
            size: 28, // 14pt
            bold: true,
            color: UI_GREEN,
          }),
        ],
        keepNext: true,
        spacing: { before: documentModel.cover ? 360 : 240, after: 160 }, // 18pt after info table
      })
    );

    docChildren.push(
      new TableOfContents(lang === "en" ? "Table of Contents" : "Mục lục", {
        hyperlink: true,
        headingStyleRange: "1-2",
      })
    );

    // Followed by a page break; body starts on page 2
    docChildren.push(
      new Paragraph({
        children: [new PageBreak()],
        spacing: { before: 120 },
      })
    );
  }

  // Helper to build cell contents for a half figure
  const buildHalfFigureCellChildren = (fig) => {
    const cellChildren = [];
    const img = capturedImages[fig.chartId];
    if (img && img.dataUrl) {
      const targetWidthPx = 295; // 7.8 cm * 37.8 ≈ 295 px
      const targetHeightPx = Math.round(targetWidthPx * (img.heightPx / img.widthPx)) || 184;

      cellChildren.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: dataUrlToUint8Array(img.dataUrl),
              transformation: { width: targetWidthPx, height: targetHeightPx },
            }),
          ],
          alignment: AlignmentType.CENTER,
          keepNext: true, // image paragraph -> its caption
          spacing: { before: 40, after: 40 },
        })
      );
    }

    // Figure caption paragraph (after 8pt = 160 twips)
    cellChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: fig.caption,
            font: "Arial",
            size: 19, // 9.5pt
            italics: true,
            color: "626C65",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 160 },
      })
    );

    // Insights bullets at 9pt (after 2pt = 40 twips)
    for (const item of fig.insights || []) {
      cellChildren.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({
              text: item,
              font: "Arial",
              size: 18, // 9pt
              color: "121A14",
            }),
          ],
          spacing: { before: 0, after: 40, line: 276 },
        })
      );
    }

    return cellChildren;
  };

  // Convert blocks to docx elements
  const blocks = documentModel.blocks || [];
  let bIdx = 0;

  while (bIdx < blocks.length) {
    const block = blocks[bIdx];

    // Check for consecutive half figures -> 2 charts per row
    if (block.type === "figure" && block.width === "half") {
      const halfGroup = [];
      while (bIdx < blocks.length && blocks[bIdx].type === "figure" && blocks[bIdx].width === "half") {
        halfGroup.push(blocks[bIdx]);
        bIdx++;
      }

      for (let g = 0; g < halfGroup.length; g += 2) {
        if (g + 1 < halfGroup.length) {
          // Pair of 2 half figures -> 2-column borderless table
          const figLeft = halfGroup[g];
          const figRight = halfGroup[g + 1];

          const leftCellChildren = buildHalfFigureCellChildren(figLeft);
          const rightCellChildren = buildHalfFigureCellChildren(figRight);

          const tableRow = new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: leftCellChildren,
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: rightCellChildren,
              }),
            ],
          });

          docChildren.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
              },
              rows: [tableRow],
            })
          );
        } else {
          // Lone half figure at the end of the group -> full width at 12 cm centered
          const loneFig = halfGroup[g];
          const img = capturedImages[loneFig.chartId];
          if (img && img.dataUrl) {
            const targetWidthPx = 454; // 12 cm * 37.8 ≈ 454 px
            const targetHeightPx = Math.round(targetWidthPx * (img.heightPx / img.widthPx)) || 284;

            docChildren.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: dataUrlToUint8Array(img.dataUrl),
                    transformation: { width: targetWidthPx, height: targetHeightPx },
                  }),
                ],
                alignment: AlignmentType.CENTER,
                keepNext: true, // image paragraph -> its caption
                spacing: { before: 60, after: 40 },
              })
            );

            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: loneFig.caption,
                    font: "Arial",
                    size: 19, // 9.5pt
                    italics: true,
                    color: "626C65",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 160 }, // after 8pt
              })
            );

            for (const item of loneFig.insights || []) {
              docChildren.push(
                new Paragraph({
                  bullet: { level: 0 },
                  children: [
                    new TextRun({
                      text: item,
                      font: "Arial",
                      size: 20, // 10pt
                      color: "121A14",
                    }),
                  ],
                  spacing: { before: 0, after: 40, line: 276 }, // after 2pt
                })
              );
            }
          }
        }
      }
      continue;
    }

    if (block.type === "heading") {
      if (block.level === 1) {
        docChildren.push(
          new Paragraph({
            text: block.text,
            heading: HeadingLevel.HEADING_1,
            keepNext: true, // heading -> next paragraph
            spacing: { before: 240, after: 120 }, // before 12pt / after 6pt
            run: { font: "Arial", size: 32, bold: true, color: UI_GREEN },
          })
        );
      } else {
        docChildren.push(
          new Paragraph({
            text: block.text,
            heading: HeadingLevel.HEADING_2,
            keepNext: true, // heading -> next paragraph
            spacing: { before: 200, after: 80 }, // before 10pt / after 4pt
            run: { font: "Arial", size: 26, bold: true, color: UI_GREEN },
          })
        );
      }
    } else if (block.type === "paragraph") {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: block.text,
              font: "Arial",
              size: 22, // 11pt
              color: block.style === "muted" ? "626C65" : "121A14",
            }),
          ],
          spacing: { before: 0, after: 120, line: 276 }, // before 0pt / after 6pt, 1.15 line
        })
      );
    } else if (block.type === "bullets") {
      for (const bulletItem of block.items || []) {
        docChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: bulletItem,
                font: "Arial",
                size: 22, // 11pt
                color: "121A14",
              }),
            ],
            spacing: { before: 0, after: 40, line: 276 }, // after 2pt
          })
        );
      }
    } else if (block.type === "note") {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: block.text,
              font: "Arial",
              size: 19, // 9.5pt
              italics: true,
              color: "8C948D",
            }),
          ],
          spacing: { before: 40, after: 80 },
        })
      );
    } else if (block.type === "figure") {
      // Full figure (width 15 cm)
      const img = capturedImages[block.chartId];
      if (img && img.dataUrl) {
        const targetWidthPx = 567; // 15 cm * 37.8 ≈ 567 px
        const targetHeightPx = Math.round(targetWidthPx * (img.heightPx / img.widthPx)) || 260;

        docChildren.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: dataUrlToUint8Array(img.dataUrl),
                transformation: { width: targetWidthPx, height: targetHeightPx },
              }),
            ],
            alignment: AlignmentType.CENTER,
            keepNext: true, // image paragraph -> its caption
            spacing: { before: 80, after: 40 },
          })
        );

        // Figure caption paragraph (after 8pt = 160 twips)
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.caption,
                font: "Arial",
                size: 19, // 9.5pt
                italics: true,
                color: "626C65",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 160 },
          })
        );

        // Insights bullets
        for (const item of block.insights || []) {
          docChildren.push(
            new Paragraph({
              bullet: { level: 0 },
              children: [
                new TextRun({
                  text: item,
                  font: "Arial",
                  size: 22, // 11pt
                  color: "121A14",
                }),
              ],
              spacing: { before: 0, after: 40, line: 276 }, // after 2pt
            })
          );
        }

        // AI explanation paragraph
        if (block.aiExplanation) {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: block.aiExplanation,
                  font: "Arial",
                  size: 22, // 11pt
                  color: "121A14",
                }),
              ],
              spacing: { before: 40, after: 120, line: 276 },
            })
          );
        }
      }
    } else if (block.type === "table") {
      // Table caption placed above table: before 6pt / after 3pt
      if (block.caption) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.caption,
                font: "Arial",
                size: 19, // 9.5pt
                bold: true,
                color: "121A14",
              }),
            ],
            keepNext: true, // table caption -> table
            spacing: { before: 120, after: 60 }, // before 6pt / after 3pt
          })
        );
      }

      // Build TableRow items
      const tableRows = [];

      // Header row (shaded light theme green, borders light gray)
      if (block.columns && block.columns.length > 0) {
        const headerCells = block.columns.map((col) => {
          return new TableCell({
            width: { size: col.widthPct, type: WidthType.PERCENTAGE },
            shading: { fill: "EAF2EB" },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "E5E5E3" },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: UI_GREEN },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: col.title,
                    font: "Arial",
                    size: 19, // 9.5pt
                    bold: true,
                    color: "121A14",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
              }),
            ],
          });
        });

        tableRows.push(
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: headerCells,
          })
        );
      }

      // Body rows
      for (const row of block.rows || []) {
        const rowCells = row.map((cell, cIdx) => {
          const colDef = block.columns?.[cIdx];
          const cellWidthPct = colDef ? colDef.widthPct : Math.floor(100 / row.length);

          const cellAlignment = cell.align === "center"
            ? AlignmentType.CENTER
            : cell.align === "right"
            ? AlignmentType.RIGHT
            : AlignmentType.LEFT;

          const fillHex = cell.fill ? cleanHex(cell.fill, "FFFFFF") : "FFFFFF";
          const textHex = cell.color ? cleanHex(cell.color, "121A14") : "121A14";

          return new TableCell({
            width: { size: cellWidthPct, type: WidthType.PERCENTAGE },
            shading: { fill: fillHex },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 2, color: "EAEAEA" },
              bottom: { style: BorderStyle.SINGLE, size: 2, color: "EAEAEA" },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cell.text,
                    font: "Arial",
                    size: 19, // 9.5pt
                    bold: Boolean(cell.bold),
                    color: textHex,
                  }),
                ],
                alignment: cellAlignment,
                spacing: { before: 30, after: 30 },
              }),
            ],
          });
        });

        tableRows.push(
          new TableRow({
            cantSplit: true,
            children: rowCells,
          })
        );
      }

      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "E5E5E3" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E5E3" },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "EAEAEA" },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: tableRows,
        })
      );
    }

    bIdx++;
  }

  // 4. Construct docx Document with custom styles and automatic TOC fields
  const doc = new Document({
    features: {
      updateFields: true,
    },
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
          },
        },
        heading1: {
          run: {
            font: "Arial",
            size: 32, // 16pt
            bold: true,
            color: UI_GREEN,
          },
          paragraph: {
            spacing: { before: 240, after: 120 },
            keepNext: true,
          },
        },
        heading2: {
          run: {
            font: "Arial",
            size: 26, // 13pt
            bold: true,
            color: UI_GREEN,
          },
          paragraph: {
            spacing: { before: 200, after: 80 },
            keepNext: true,
          },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            size: 32,
            bold: true,
            color: UI_GREEN,
          },
          paragraph: {
            spacing: { before: 240, after: 120 },
            keepNext: true,
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            size: 26,
            bold: true,
            color: UI_GREEN,
          },
          paragraph: {
            spacing: { before: 200, after: 80 },
            keepNext: true,
          },
        },
        {
          id: "TOC1",
          name: "toc 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            size: 22, // 11pt
            color: "000000",
          },
          paragraph: {
            spacing: { before: 40, after: 40 },
          },
        },
        {
          id: "TOC2",
          name: "toc 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            size: 22, // 11pt
            color: "000000",
          },
          paragraph: {
            indent: { left: 283 }, // 0.5 cm = 283 twips
            spacing: { before: 30, after: 30 },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: marginTwips, right: marginTwips, bottom: marginTwips, left: marginTwips },
          },
        },
        footers: {
          default: bodyFooter,
        },
        children: docChildren,
      },
    ],
  });

  // 5. Generate blob and save
  const cleanName = (documentModel.meta?.fileName || "Dataset").replace(/\.[^/.]+$/, "");
  const outFileName = `DataMind_Report_${cleanName}.docx`;
  const blob = await Packer.toBlob(doc);
  saveAs(blob, outFileName);

  return outFileName;
}

