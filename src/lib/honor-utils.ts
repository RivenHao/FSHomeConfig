import { supabase } from "./supabase";

// 里程碑配置
export const MILESTONES = [
  10, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
];

// 荣誉类型
export type HonorType =
  | "milestone_10"
  | "milestone_50"
  | "milestone_100"
  | "milestone_150"
  | "milestone_200"
  | "milestone_300"
  | "milestone_400"
  | "milestone_500"
  | "milestone_600"
  | "milestone_700"
  | "milestone_800"
  | "milestone_900"
  | "milestone_1000"
  | "season_1st"
  | "season_2nd"
  | "season_3rd";

export type HonorCategory = "milestone" | "season";

// 荣誉配置
export const HONOR_CONFIG: Record<
  HonorType,
  { name: string; icon: string; category: HonorCategory }
> = {
  milestone_10: {
    name: "解锁招式突破10！",
    icon: "milestone_10.png",
    category: "milestone",
  },
  milestone_50: {
    name: "解锁招式突破50！",
    icon: "milestone_50.png",
    category: "milestone",
  },
  milestone_100: {
    name: "解锁招式突破100！",
    icon: "milestone_100.png",
    category: "milestone",
  },
  milestone_150: {
    name: "解锁招式突破150！",
    icon: "milestone_150.png",
    category: "milestone",
  },
  milestone_200: {
    name: "解锁招式突破200！",
    icon: "milestone_200.png",
    category: "milestone",
  },
  milestone_300: {
    name: "解锁招式突破300！",
    icon: "milestone_300.png",
    category: "milestone",
  },
  milestone_400: {
    name: "解锁招式突破400！",
    icon: "milestone_400.png",
    category: "milestone",
  },
  milestone_500: {
    name: "解锁招式突破500！",
    icon: "milestone_500.png",
    category: "milestone",
  },
  milestone_600: {
    name: "解锁招式突破600！",
    icon: "milestone_600.png",
    category: "milestone",
  },
  milestone_700: {
    name: "解锁招式突破700！",
    icon: "milestone_700.png",
    category: "milestone",
  },
  milestone_800: {
    name: "解锁招式突破800！",
    icon: "milestone_800.png",
    category: "milestone",
  },
  milestone_900: {
    name: "解锁招式突破900！",
    icon: "milestone_900.png",
    category: "milestone",
  },
  milestone_1000: {
    name: "解锁招式突破1000！",
    icon: "milestone_1000.png",
    category: "milestone",
  },
  season_1st: { name: "赛季No.1", icon: "season_1st.png", category: "season" },
  season_2nd: { name: "赛季No.2", icon: "season_2nd.png", category: "season" },
  season_3rd: { name: "赛季No.3", icon: "season_3rd.png", category: "season" },
};

// 图标基础路径
const HONOR_ICON_BASE = "https://r2.freestyler.site/honors/";

/**
 * 检查并授予里程碑荣誉
 * @param userId 用户ID
 * @param currentUnlockCount 当前解锁数量
 */
export async function checkAndGrantMilestoneHonor(
  userId: string,
  currentUnlockCount: number
): Promise<void> {
  try {
    // 检查每个里程碑
    for (const milestone of MILESTONES) {
      // 如果刚好达到里程碑
      if (currentUnlockCount === milestone) {
        const honorType = `milestone_${milestone}` as HonorType;
        const config = HONOR_CONFIG[honorType];

        // 尝试插入荣誉记录（使用 upsert 避免重复）
        const { error } = await supabase.from("user_honors").upsert(
          {
            user_id: userId,
            honor_type: honorType,
            honor_category: config.category,
            honor_name: config.name,
            honor_icon: `${HONOR_ICON_BASE}${config.icon}`,
            reference_value: milestone,
            earned_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,honor_type,reference_id",
            ignoreDuplicates: true,
          }
        );

        if (error) {
          console.error(`授予里程碑荣誉失败 (${honorType}):`, error);
        } else {
          console.log(`用户 ${userId} 获得里程碑荣誉: ${config.name}`);
        }

        // 只处理当前达到的里程碑，不需要继续检查
        break;
      }
    }
  } catch (error) {
    console.error("检查里程碑荣誉失败:", error);
  }
}

/**
 * 授予赛季排名荣誉
 * @param userId 用户ID
 * @param seasonId 赛季ID
 * @param seasonName 赛季名称
 * @param rank 排名 (1, 2, 3)
 */
export async function grantSeasonRankHonor(
  userId: string,
  seasonId: string,
  seasonName: string,
  rank: 1 | 2 | 3
): Promise<void> {
  try {
    const honorTypeMap: Record<number, HonorType> = {
      1: "season_1st",
      2: "season_2nd",
      3: "season_3rd",
    };

    const honorType = honorTypeMap[rank];
    const config = HONOR_CONFIG[honorType];
    const honorName = `${seasonName}${config.name}`;

    const { error } = await supabase.from("user_honors").upsert(
      {
        user_id: userId,
        honor_type: honorType,
        honor_category: config.category,
        honor_name: honorName,
        honor_icon: `${HONOR_ICON_BASE}${config.icon}`,
        reference_id: seasonId,
        earned_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,honor_type,reference_id",
        ignoreDuplicates: true,
      }
    );

    if (error) {
      console.error(`授予赛季荣誉失败 (${honorType}):`, error);
    } else {
      console.log(`用户 ${userId} 获得赛季荣誉: ${honorName}`);
    }
  } catch (error) {
    console.error("授予赛季荣誉失败:", error);
  }
}

/**
 * 获取用户的所有荣誉
 * @param userId 用户ID
 */
export async function getUserHonors(userId: string) {
  const { data, error } = await supabase
    .from("user_honors")
    .select("*")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  if (error) {
    console.error("获取用户荣誉失败:", error);
    return [];
  }

  return data || [];
}
