
import { GoogleGenAI, Type } from "@google/genai";
import { Room, MaterialItem, RenderRequest, BuildingMap, LibraryItem, RenderResult } from "../types";

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
    switch(request.type) {
      case 'exterior_iso': workflowTitle = "Exterior Massing"; break;
      case 'exterior_elev': workflowTitle = "Flat Elevation"; break;
      case 'interior_plan': workflowTitle = "Top-Down Plan"; break;
      case 'interior_persp': workflowTitle = "Interior Room"; break;
    }
    const workflow = this.getWorkflowTemplate(library, workflowTitle);

    let userPrompt = workflow
      .replace(/{DIRECTION}/g, request.viewpoint)
      .replace(/{ROOM_NAME}/g, room?.name || "Target Space");
    
    userPrompt = `${userPrompt}\n\n---\n\n${rubric}`;

    // STAGE 1: GENERATE
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

    if (!imageUrl) throw new Error("Stage 1 Pipeline Failure: The model returned no image data.");

    // STAGE 2: VALIDATE (Audit)
    onProgress?.("STAGE 2: RUNNING CONFORMITY AUDIT ON RENDER...");
    const auditWorkflow = this.getWorkflowTemplate(library, "Axiom Audit");
    const auditResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: imageUrl.split(',')[1] } },
          { text: auditWorkflow || "Audit this image against the cardinal wall axioms. Be extremely critical. List every discrepancy." }
        ]
      },
      config: { systemInstruction }
    });

    const auditText = auditResponse.text || "No audit feedback received.";
    const isVerified = !auditText.toLowerCase().includes("violation") && 
                       !auditText.toLowerCase().includes("fail") &&
                       !auditText.toLowerCase().includes("axiom error");

    return {
      id: Math.random().toString(36).substr(2, 9),
      imageUrl,
      selfScoreText,
      auditText,
      isValidated: true,
      status: isVerified ? 'VERIFIED' : 'VIOLATION',
      request,
      timestamp: Date.now()
    };
  }
}
