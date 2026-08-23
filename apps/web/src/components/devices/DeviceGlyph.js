"use client";

import { createElement } from "react";
import { Battery, BatteryLow } from "lucide-react";

import { deviceIcon } from "@/lib/constants";

/**
 * Renders the icon for a device type.
 *
 * createElement rather than `const Icon = deviceIcon(type)` followed by
 * `<Icon />`: assigning the result of a call to a capitalised variable and
 * rendering it reads as constructing a component during render, which defeats
 * memoisation and is flagged by the React lint rules.
 */
export const DeviceGlyph = ({ type, className }) =>
  createElement(deviceIcon(type), { className });

export const BatteryGlyph = ({ level, className }) =>
  createElement(level !== null && level < 20 ? BatteryLow : Battery, { className });

export default DeviceGlyph;
