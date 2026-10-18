/* Shared mutable state: what is selected and shown (state) and where the camera is and is heading (view). */
import { deg } from "./util.js";

/* app state */
export const state = { mode:"countries", year:4, selected:null, selectedDC:null, hovered:null, pinned:[], built:false, tab:"usage", layer:"none", providerFilter:null, providerTop:null, keyCollapsed: (() => { try { const v = localStorage.getItem("keyCollapsed"); if (v !== null) return v === "1"; } catch(_){} return window.matchMedia("(max-width:900px)").matches; })() };

/* camera: yaw/pitch of the world group, dolly distance, and the screen-parallel pan; the t* fields are the targets the frame loop eases towards */
export const view = { yaw:-(-20*deg), pitch:22*deg, tYaw:0, tPitch:22*deg, dist:4, tDist:4, minDist:1.22, maxDist:4, yawVel:0, pitchVel:0, lastInteract:-1e9, flying:false, panX:0, panY:0, tPanX:0, tPanY:0 };
view.yaw = view.tYaw = -20*deg; view.pitch = view.tPitch = 6*deg; // centre lon ≈ 20°E, lat ≈ 6°N: Africa fills the middle of the opening view, Europe above, the Middle East and India to the right

/* input environment: coarse pointers (phones, tablets) read “Tap” where mice read “Click” */
export const COARSE = window.matchMedia("(pointer:coarse)").matches, TAP = COARSE ? "Tap" : "Click";
