import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  Truck,
  Zap,
  Award,
  HeartPulse,
  CheckCircle2,
  Clock,
  PhoneCall,
  Star,
  Check,
  X,
  Lock,
  ShoppingBag,
  ArrowRight,
  Flame,
  ThumbsUp,
  RotateCcw,
  LucideProps,
} from 'lucide-react';

interface DynamicIconProps extends LucideProps {
  name: string;
}

const iconMap: Record<string, React.FC<LucideProps>> = {
  Sparkles,
  ShieldCheck,
  Truck,
  Zap,
  Award,
  HeartPulse,
  CheckCircle2,
  Clock,
  PhoneCall,
  Star,
  Check,
  X,
  Lock,
  ShoppingBag,
  ArrowRight,
  Flame,
  ThumbsUp,
  RotateCcw,
};

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
  const IconComponent = iconMap[name] || Sparkles;
  return <IconComponent {...props} />;
};
