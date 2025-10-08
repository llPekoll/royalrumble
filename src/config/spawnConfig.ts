/**
 * Spawn Configuration
 * Controls the shape and positioning of participant spawn locations
 */

export const SPAWN_CONFIG = {
  // Ellipse ratios - multiply radius by these values for each axis
  ELLIPSE_RATIO_X: 1.8,  // 80% wider on horizontal axis
  ELLIPSE_RATIO_Y: 0.5,  // 50% flatter on vertical axis

  // Default spawn radius (before ellipse transformation)
  DEFAULT_SPAWN_RADIUS: 250,

  // Variation ranges for randomness - creates messy, scattered effect
  RADIUS_VARIATION: 200,     // ±100 pixels (increased for more mess)
  ANGLE_VARIATION: 0.8,      // ±0.4 radians (~±23 degrees, increased for more mess)
  POSITION_JITTER_X: 60,     // Additional random X offset (±30 pixels)
  POSITION_JITTER_Y: 40,     // Additional random Y offset (±20 pixels)
} as const;

/**
 * Calculate elliptical spawn position with randomness
 * @param angle - Angle in radians (0 to 2π)
 * @param radius - Base radius before ellipse transformation
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param withRandomness - Whether to apply jitter (default true)
 * @returns Position {x, y}
 */
export function calculateEllipsePosition(
  angle: number,
  radius: number,
  centerX: number,
  centerY: number,
  withRandomness: boolean = true
): { x: number; y: number } {
  const baseX = centerX + Math.cos(angle) * radius * SPAWN_CONFIG.ELLIPSE_RATIO_X;
  const baseY = centerY + Math.sin(angle) * radius * SPAWN_CONFIG.ELLIPSE_RATIO_Y;

  if (!withRandomness) {
    return { x: baseX, y: baseY };
  }

  // Add random jitter to make it messy
  const jitterX = (Math.random() - 0.5) * SPAWN_CONFIG.POSITION_JITTER_X;
  const jitterY = (Math.random() - 0.5) * SPAWN_CONFIG.POSITION_JITTER_Y;

  return {
    x: baseX + jitterX,
    y: baseY + jitterY,
  };
}
