
import { GoogleGenAI, Type } from "@google/genai";
import { Room, MaterialItem, RenderRequest, BuildingMap, LibraryItem, RenderResult, AuditFailure, AuditScore } from "../types";

export class ArchitecturalService {
  private cleanJsonResponse(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?|```$/g, "").trim();
    }
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return cleaned;
  }

  private getSystemInstruction(library: LibraryItem[]): string {
    const constitution = library
      .filter(a => a.isActive && a.category === 'A')
      .map(a => `## ${a.title}\n${a.content}`)
      .join('\n\n---\n\n');
    
    return constitution || "You are a precise architectural visualization engine. Adhere to all cardinal axioms.";
  }

  private getWorkflowTemplate(library: LibraryItem[], titleMatch: string): string {
    const item = library.find(a => a.category === 'B' && a.title.toLowerCase().includes(titleMatch.toLowerCase()));
    return item?.content || "";
  }

  async rationalizePlan(files: {data: string, mimeType: string}[], library: LibraryItem[]): Promise<{ map: BuildingMap, inventory: MaterialItem[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = this.getSystemInstruction(library);
    
    const parts = files.map(file => ({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data.split(',')[1]
      }
    }));

    const auditWorkflow = this.getWorkflowTemplate(library, "Axiom Audit");

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          ...parts,
          { text: auditWorkflow || `Perform a high-fidelity spatial audit. Return JSON.` }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            map: {
              type: Type.OBJECT,
              properties: {
                totalLevels: { type: Type.NUMBER },
                globalFootprint: { type: Type.STRING },
                exteriorFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
                rooms: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      level: { type: Type.NUMBER },
                      dimensions: { type: Type.STRING },
                      sqFt: { type: Type.NUMBER },
                      structuralFeatures: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            type: { type: Type.STRING },
                            location: { type: Type.STRING },
                            details: { type: Type.STRING }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            inventory: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  room: { type: Type.STRING },
                  category: { type: Type.STRING },
                  type: { type: Type.STRING },
                  quantity: { type: Type.STRING },
                  notes: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const cleanedText = this.cleanJsonResponse(response.text || "");
    return JSON.parse(cleanedText);
  }

  private async runStage2Audit(imageUrl: string, systemInstruction: string): Promise<any> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const auditWorkflow = `Analyze the attached rendering against the Cardinal Wall Axioms. 

For EACH visible wall:
1. Count every architectural element (doors, windows, openings)
2. Compare counts against axiom specifications
3. Check roof form, pitch, and ridge direction
4. Check staircase placement, direction, and solidity
5. Check deck shape, placement, and railing

Return your response as JSON with this exact structure:
{
  "narrative": "Your detailed wall-by-wall audit text here...",
  "verdict": "PASS" or "FAIL",
  "failures": [
    {
      "category": "ROOF" | "STAIRCASE" | "SOUTH_WALL" | "EAST_WALL" | "WEST_WALL" | "NORTH_WALL" | "DECK" | "FOOTPRINT",
      "description": "What is wrong",
      "axiom_correction": "What the axiom actually requires"
    }
  ],
  "score": {
    "structural_accuracy": 0-10,
    "spatial_geometry": 0-10,
    "staircase_fidelity": 0-10,
    "deck_accuracy": 0-10,
    "south_wall_solidity": 0-10,
    "render_quality": 0-10,
    "total": 0-60
  }
}`;

    const auditResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: imageUrl.split(',')[1] } },
          { text: auditWorkflow }
        ]
      },
      config: { 
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            verdict: { type: Type.STRING },
            failures: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  description: { type: Type.STRING },
                  axiom_correction: { type: Type.STRING }
                }
              }
            },
            score: {
              type: Type.OBJECT,
              properties: {
                structural_accuracy: { type: Type.NUMBER },
                spatial_geometry: { type: Type.NUMBER },
                staircase_fidelity: { type: Type.NUMBER },
                deck_accuracy: { type: Type.NUMBER },
                south_wall_solidity: { type: Type.NUMBER },
                render_quality: { type: Type.NUMBER },
                total: { type: Type.NUMBER }
              }
            }
          }
        }
      }
    });

    return JSON.parse(this.cleanJsonResponse(auditResponse.text || "{}"));
  }

  async executeRenderPipeline(
    request: RenderRequest, 
    library: LibraryItem[], 
    room?: Room,
    onProgress?: (msg: string) => void
  ): Promise<RenderResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = this.getSystemInstruction(library);
    const rubric = this.getWorkflowTemplate(library, "Scoring Rubric");
    
    let workflowTitle = "";
    let style = "";
    switch(request.type) {
      case 'exterior_iso': 
        workflowTitle = "Exterior Massing"; 
        style = "Clean white-clay architectural model. No textures, no landscaping, no color. White/light gray surfaces with subtle shadows. Crisp structural lines. Studio lighting on neutral gray background.";
        break;
      case 'exterior_elev': 
        workflowTitle = "Flat Elevation"; 
        style = "Clean architectural elevation drawing — white/light surfaces, dark outlines, labeled elements, dimension lines.";
        break;
      case 'interior_plan': 
        workflowTitle = "Top-Down Plan"; 
        style = "Clean architectural plan — white walls as solid dark lines, labeled rooms, furniture as plan-view outlines.";
        break;
      case 'interior_persp': 
        workflowTitle = "Interior Room"; 
        style = "Warm residential interior, natural materials, clean modern aesthetic. Realistic lighting with natural light from windows.";
        break;
    }
    const workflow = this.getWorkflowTemplate(library, workflowTitle);

    let userPrompt = workflow
      .replace(/{DIRECTION}/g, request.viewpoint)
      .replace(/{ROOM_NAME}/g, room?.name || "Target Space");
    
    userPrompt = `${userPrompt}\nSTYLE: ${style}\n\n---\n\n${rubric}`;

    onProgress?.("STAGE 1: GENERATING ARCHITECTURAL GEOMETRY...");
    const genResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: userPrompt }] },
      config: {
        systemInstruction,
        imageConfig: { aspectRatio: "16:9", imageSize: "1K" }
      }
    });

    let imageUrl = "";
    let selfScoreText = "";
    for (const part of genResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      if (part.text) selfScoreText += part.text;
    }

    if (!imageUrl) throw new Error("Stage 1 Pipeline Failure: No image returned.");

    onProgress?.("STAGE 2: RUNNING CONFORMITY AUDIT...");
    const auditData = await this.runStage2Audit(imageUrl, systemInstruction);
    const isVerified = auditData.verdict === "PASS" && auditData.score.total >= 42;

    return {
      id: Math.random().toString(36).substr(2, 9),
      imageUrl,
      selfScoreText,
      auditText: auditData.narrative,
      auditFailures: auditData.failures,
      auditScore: auditData.score,
      isValidated: true,
      status: isVerified ? 'VERIFIED' : 'VIOLATION',
      request,
      timestamp: Date.now(),
      refinementPass: 0
    };
  }

  async executeRefinement(
    originalResult: RenderResult,
    request: RenderRequest,
    library: LibraryItem[],
    room?: Room,
    onProgress?: (msg: string) => void
  ): Promise<RenderResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = this.getSystemInstruction(library);
    const rubric = this.getWorkflowTemplate(library, "Scoring Rubric");
    const currentPass = (originalResult.refinementPass || 0) + 1;

    if (currentPass > 3) {
      return {
        ...originalResult,
        auditText: `${originalResult.auditText}\n\nMaximum refinement passes reached. Manual review required.`,
        status: 'VIOLATION'
      };
    }

    const failureList = originalResult.auditFailures?.map(f => `- ${f.category}: ${f.description} (Fix: ${f.axiom_correction})`).join('\n') || "Minor axiom adjustments needed.";

    const refinementPrompt = `REFINEMENT PASS ${currentPass} — Correcting Previous Render

The previous render had the following axiom violations:
${failureList}

Re-generate the same viewpoint (${request.type}, ${request.viewpoint}) with these SPECIFIC corrections applied.
CRITICAL: Do not introduce NEW errors while fixing old ones. Every element not mentioned in the corrections list must remain exactly as it was in the original render.

---

${rubric}`;

    onProgress?.(`STAGE 3: REFINING RENDER (PASS ${currentPass}/3)...`);
    const genResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: originalResult.imageUrl.split(',')[1] } },
          { text: refinementPrompt }
        ]
      },
      config: {
        systemInstruction,
        imageConfig: { aspectRatio: "16:9", imageSize: "1K" }
      }
    });

    let imageUrl = "";
    let selfScoreText = "";
    for (const part of genResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      if (part.text) selfScoreText += part.text;
    }

    if (!imageUrl) throw new Error("Refinement Failure: No image returned.");

    onProgress?.("STAGE 4: RE-AUDITING REFINED RENDER...");
    const auditData = await this.runStage2Audit(imageUrl, systemInstruction);
    const isVerified = auditData.verdict === "PASS" && auditData.score.total >= 42;

    return {
      id: Math.random().toString(36).substr(2, 9),
      imageUrl,
      selfScoreText,
      auditText: auditData.narrative,
      auditFailures: auditData.failures,
      auditScore: auditData.score,
      isValidated: true,
      status: isVerified ? 'VERIFIED' : 'VIOLATION',
      request,
      timestamp: Date.now(),
      refinementPass: currentPass
    };
  }
}
