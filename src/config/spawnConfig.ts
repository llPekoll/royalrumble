/**
 * Spawn Configuration
 * Controls the shape and positioning of participant spawn locations
 */

export const SPAWN_CONFIG = {
  // Ellipse ratios - multiply radius by these values for each axis
  ELLIPSE_RATIO_X: 1.8, // 80% wider on horizontal axis
  ELLIPSE_RATIO_Y: 0.5, // 50% flatter on vertical axis

  // Default spawn radius (before ellipse transformation)
  DEFAULT_SPAWN_RADIUS: 250,

  // Variation ranges for randomness - creates messy, scattered effect
  RADIUS_VARIATION: 200, // ±100 pixels
  ANGLE_VARIATION: 0.8, // ±0.4 radians (~±23 degrees)
  POSITION_JITTER_X: 60, // Additional random X offset (±30 pixels)
  POSITION_JITTER_Y: 40, // Additional random Y offset (±20 pixels)
} as const;

// REMOVED: Spawn zones system - no longer needed with true random spawning
// Old zone-based approach created predictable patterns

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

// REMOVED: calculateZonedSpawnPosition() - was using incremental index pattern
// Now we use generateRandomEllipsePositions() which is truly random

/**
 * Generate shuffled positions on an ellipse with jitter
 * Creates evenly distributed spawn points that are then randomized
 * @param count - Number of positions to generate
 * @param radius - Base radius of the ellipse
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @returns Array of shuffled positions with jitter
 */
export function generateShuffledEllipsePositions(
  count: number,
  radius: number,
  centerX: number,
  centerY: number
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];

  // Generate positions evenly distributed around ellipse
  console.log("[SpawnConfig] Starting generation with count:", count);

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;

    // Apply radius variation
    const radiusVariation = (Math.random() - 0.5) * SPAWN_CONFIG.RADIUS_VARIATION;
    const finalRadius = radius + radiusVariation;

    // Apply angle variation
    const angleVariation = (Math.random() - 0.5) * SPAWN_CONFIG.ANGLE_VARIATION;
    const finalAngle = angle + angleVariation;

    // Calculate ellipse position
    const position = calculateEllipsePosition(finalAngle, finalRadius, centerX, centerY, true);

    console.log(`[SpawnConfig] Generated position ${i}:`, {
      angle: angle.toFixed(2),
      finalAngle: finalAngle.toFixed(2),
      finalRadius: Math.round(finalRadius),
      position: { x: Math.round(position.x), y: Math.round(position.y) },
    });

    positions.push(position);
  }

  console.log(
    "[SpawnConfig] BEFORE shuffle - first 3:",
    positions.slice(0, 3).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
  );

  // Shuffle using Fisher-Yates algorithm with extra randomization
  // Do multiple passes to ensure thorough mixing
  for (let pass = 0; pass < 3; pass++) {
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
  }
  return positions;
}
