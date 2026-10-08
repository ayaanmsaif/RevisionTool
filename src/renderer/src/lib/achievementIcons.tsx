import {
  BrainIcon,
  ChatCircleTextIcon,
  CrownIcon,
  FireIcon,
  KeyboardIcon,
  LightningIcon,
  MoonIcon,
  PlantIcon,
  StackIcon,
  StarIcon,
  SunIcon,
  TargetIcon,
  TimerIcon,
  TrophyIcon,
  type Icon
} from '@phosphor-icons/react'
import type { Achievement } from '../core/gamify'

export const ACHIEVEMENT_ICON: Record<Achievement['icon'], Icon> = {
  seed: PlantIcon,
  stack: StackIcon,
  fire: FireIcon,
  lightning: LightningIcon,
  target: TargetIcon,
  trophy: TrophyIcon,
  brain: BrainIcon,
  keyboard: KeyboardIcon,
  moon: MoonIcon,
  sun: SunIcon,
  star: StarIcon,
  crown: CrownIcon,
  timer: TimerIcon,
  chat: ChatCircleTextIcon
}
