// world-engine-core.js — 核心数据结构与存储（按聊天ID隔离）
window.WORLD_ENGINE_CORE = (function() {
  const STORAGE_PREFIX = 'world_engine_';
  const EVENT_TYPES = ['conflict', 'progress'];
  const EVENT_STAGE_ORDER = {
    conflict: ['萌芽', '发酵', '逼近'],
    progress: ['筹备', '执行', '关键']
  };
  const EVENT_STAGE_MAP = {
    conflict: ['萌芽', '发酵', '逼近', '已爆发', '已消散'],
    progress: ['筹备', '执行', '关键', '已完成', '已失败']
  };
  const EVENT_SUCCESS_STAGE = {
    conflict: '已爆发',
    progress: '已完成'
  };
  const EVENT_TERMINAL_STAGES = {
    conflict: ['已爆发', '已消散'],
    progress: ['已完成', '已失败']
  };

  // ========== 情感状态机 ==========
  const EMOTION_STATES = {
    FRIENDLY:  { name: '友好', color: '#4caf50', decayRate: 0.5, description: '友善亲切' },
    JOYFUL:    { name: '愉快', color: '#ffd700', decayRate: 0.7, description: '心情愉悦' },
    NEUTRAL:   { name: '中立', color: '#9e9e9e', decayRate: 0.3, description: '无特殊情绪' },
    ANNOYED:   { name: '烦躁', color: '#ff9800', decayRate: 0.6, description: '有些不耐烦' },
    ANGRY:     { name: '愤怒', color: '#f44336', decayRate: 0.8, description: '怒气冲冲' },
    SAD:       { name: '悲伤', color: '#2196f3', decayRate: 0.5, description: '情绪低落' },
    FEARFUL:   { name: '恐惧', color: '#9c27b0', decayRate: 0.4, description: '心生畏惧' },
    SURPRISED: { name: '惊讶', color: '#e91e63', decayRate: 0.9, description: '深感意外' },
  };
  const EMOTION_TRANSITIONS = {
    combat_win:    { JOYFUL: 0.4, ANGRY: 0.1, NEUTRAL: 0.3, FRIENDLY: 0.2 },
    combat_lose:   { SAD: 0.3, FEARFUL: 0.3, ANGRY: 0.2, NEUTRAL: 0.2 },
    combat_neutral:{ NEUTRAL: 0.4, ANNOYED: 0.3, JOYFUL: 0.1, FEARFUL: 0.2 },
    help_received: { FRIENDLY: 0.5, JOYFUL: 0.3, SURPRISED: 0.2 },
    help_given:    { FRIENDLY: 0.3, JOYFUL: 0.4, NEUTRAL: 0.3 },
    betrayed:      { ANGRY: 0.5, SAD: 0.3, FEARFUL: 0.2 },
    gift_received: { JOYFUL: 0.4, FRIENDLY: 0.3, SURPRISED: 0.3 },
    insulted:      { ANGRY: 0.4, ANNOYED: 0.4, SAD: 0.2 },
    praised:       { JOYFUL: 0.4, FRIENDLY: 0.3, NEUTRAL: 0.2, SURPRISED: 0.1 },
    default:       { NEUTRAL: 0.5, ANNOYED: 0.2, JOYFUL: 0.2, SAD: 0.1 },
  };

  // ========== 角色生命周期 ==========
  const LIFECYCLE_STATES = {
    ALIVE:   { name: '存活', value: 0, description: '角色活跃中' },
    DYING:   { name: '濒死', value: 1, description: '角色重伤，下一轮可能死亡' },
    DEAD:    { name: '死亡', value: 2, description: '角色已死亡' },
    REBORN:  { name: '转生', value: 3, description: '角色转生归来' },
    DORMANT: { name: '休眠', value: 4, description: '角色暂时休眠' },
  };

  // ========== 连击徽章 ==========
  const COMBO_BADGES = {
    1: '', 2: '双响炮', 3: '三连杀', 4: '四重奏', 5: '五星连珠',
    6: '六六大顺', 7: '七星汇聚', 8: '八方来朝', 9: '九九归一', 10: '十全十美'
  };
  function getComboBadge(combo) {
    return COMBO_BADGES[combo] || (combo >= 20 ? '传说连击' : combo >= 15 ? '史诗连击' : combo + '连击');
  }

  // ========== 世界法则 ==========
  const WORLD_LAW_DIMENSIONS = [
    { id: 'magic',        label: '魔力浓度',  options: ['无','低','中等','高','极高'], defaultVal: '中等' },
    { id: 'tech',         label: '科技水平',  options: ['原始','中世纪','文艺复兴','工业革命','现代','科幻'], defaultVal: '中世纪' },
    { id: 'supernatural', label: '超自然存在', options: ['无','罕见','常见','丰富'], defaultVal: '常见' },
    { id: 'governance',   label: '统治形态',  options: ['封建制','帝国制','共和制','宗门统治','无政府'], defaultVal: '封建制' },
    { id: 'conflict',     label: '核心冲突',  options: ['生存','战争','求知','权力','爱恨','自由'], defaultVal: '生存' },
    { id: 'environment',  label: '自然环境',  options: ['极寒','酷热','温带','沙漠','海洋','丛林','多样'], defaultVal: '多样' },
  ];
  const WORLD_LAW_PRESETS = [
    { id: 'high_fantasy',    name: '高魔仙侠',  icon: '🐉', desc: '修真世界，灵力为尊', dimensions: { magic:'高', tech:'中世纪', supernatural:'丰富', governance:'宗门统治', conflict:'战争', environment:'多样' }, customRules:['灵力分九品，突破需渡天劫','妖兽与人族有千年血契'] },
    { id: 'cyber_xianxia',   name: '赛博仙侠',  icon: '🤖', desc: '灵气与芯片共存', dimensions: { magic:'中', tech:'现代', supernatural:'常见', governance:'帝国制', conflict:'权力', environment:'多样' }, customRules:['修仙者可使用灵能芯片增强法力','天网可监控灵气波动'] },
    { id: 'low_magic',       name: '低魔现实',  icon: '🌏', desc: '魔法几乎绝迹', dimensions: { magic:'无', tech:'文艺复兴', supernatural:'罕见', governance:'封建制', conflict:'生存', environment:'温带' }, customRules:['魔法是传说中的东西，99%的人一生未见','草药和医术是主要治疗手段'] },
    { id: 'steampunk',       name: '蒸汽朋克',  icon: '⚙️', desc: '蒸汽与齿轮驱动', dimensions: { magic:'无', tech:'工业革命', supernatural:'罕见', governance:'帝国制', conflict:'战争', environment:'温带' }, customRules:['蒸汽机是核心动力源','社会分为上城区和下城区'] },
    { id: 'wuxia',           name: '武侠江湖',  icon: '⚔️', desc: '朝廷与江湖并行', dimensions: { magic:'无', tech:'中世纪', supernatural:'罕见', governance:'封建制', conflict:'权力', environment:'多样' }, customRules:['内力修炼分层次','江湖门派有严格等级和规矩','朝廷与江湖互不干涉'] },
    { id: 'post_apocalyptic',name: '废土求生',  icon: '☢️', desc: '文明崩溃后的残酷世界', dimensions: { magic:'无', tech:'原始', supernatural:'无', governance:'无政府', conflict:'生存', environment:'多样' }, customRules:['淡水和食物是最珍贵的资源','废土上有变异生物出没','旧文明遗迹中可能找到科技遗物'] },
  ];

  // ========== 情感基调 ==========
  const EMOTIONAL_TONES = [
    { id: 'passionate', name: '热血激荡', desc: '昂扬向上，充满激情与斗志' },
    { id: 'cozy', name: '温馨治愈', desc: '温暖舒缓，治愈心灵' },
    { id: 'dark', name: '黑暗压抑', desc: '沉重绝望，危机四伏' },
    { id: 'humorous', name: '幽默诙谐', desc: '轻松搞笑，妙趣横生' },
    { id: 'suspenseful', name: '悬疑紧张', desc: '充满悬念，扣人心弦' },
    { id: 'melancholy', name: '哀伤悲怆', desc: '悲伤凄美，命运无常' },
    { id: 'tranquil', name: '宁静淡泊', desc: '平和宁静，闲适淡雅' },
    { id: 'epic', name: '史诗壮阔', desc: '宏大磅礴，吞山河' },
  ];

  // ========== 故事模板 ==========
  const STORY_TEMPLATES = [
    { id: 'hero_journey', name: '英雄之旅', source: 'Campbell《千面英雄》', summary: '英雄从平凡世界接受冒险召唤，经历试炼与挑战，最终获得奖赏并归来的古老故事模式。', phases: ['平凡世界','冒险召唤','拒绝召唤','导师出现','跨越门槛','试炼/盟友/敌人','深入洞穴','严峻考验','获得奖赏','返回之路','复活','携归物归'], promptBlock: '这个世界的叙事遵循英雄之旅的节奏：角色正在经历从平凡到非凡的蜕变。', suggestTones: ['epic','passionate'] },
    { id: 'overcome_monster', name: '战胜怪物', source: 'Booker《七种基本情节》', summary: '面对威胁与恐惧，主角集结力量，最终克服巨大困难的故事。', phases: ['威胁降临','准备战斗','首次交锋','绝境危机','绝地反击','彻底胜利'], promptBlock: '故事中的威胁正在逼近，角色必须直面恐惧并战胜它。', suggestTones: ['epic','dark'] },
    { id: 'rags_to_riches', name: '白手起家', source: 'Booker《七种基本情节》', summary: '从卑微处崛起，经历巅峰与坠落，最终获得真正价值的成长故事。', phases: ['卑微起点','崭露头角','步步高升','巅峰时刻','骤然坠落','失去一切','浴火重生'], promptBlock: '命运的起伏正在上演，角色在得失之间寻找真正的自我价值。', suggestTones: ['passionate','cozy'] },
    { id: 'the_quest', name: '征程探秘', source: 'Booker《七种基本情节》', summary: '主角为达成重要目标而踏上旅途，在重重考验中寻找答案的故事。', phases: ['使命召唤','组建队伍','踏上征途','重重关卡','核心考验','抵达终点','获得/顿悟'], promptBlock: '一段重要的征程正在进行，角色正在为某个宏大目标而跋涉。', suggestTones: ['epic','suspenseful'] },
    { id: 'voyage_return', name: '出走与回归', source: 'Booker《七种基本情节》', summary: '角色离开熟悉的环境探索未知，经历奇遇后带着成长回归的故事。', phases: ['安稳日常','离开家园','新奇探索','迷失困境','九死一生','逃出生天','满载而归'], promptBlock: '角色正在远离熟悉的环境，探索未知的世界，经历会改变一切。', suggestTones: ['cozy','tranquil'] },
    { id: 'comedy', name: '喜剧', source: 'Booker / Aristotle', summary: '误会与巧合交织，混乱中最终化解矛盾，迎来圆满结局的轻松故事。', phases: ['误会丛生','混乱升级','真相浮现','化解矛盾','皆大欢喜'], promptBlock: '误会和巧合让局面变得滑稽混乱，但最终会走向圆满。', suggestTones: ['humorous','cozy'] },
    { id: 'tragedy', name: '悲剧', source: 'Aristotle《诗学》', summary: '命运的无情轨迹——从繁盛到毁灭，因主角自身的缺陷而走向覆灭。', phases: ['繁荣顺遂','致命缺陷','错误抉择','局势逆转','众叛亲离','毁灭结局'], promptBlock: '命运的阴影正在笼罩，角色可能正走向不可逆转的悲剧结局。', suggestTones: ['melancholy','dark'] },
    { id: 'rebirth', name: '重生', source: 'Booker《七种基本情节》', summary: '陷入困境的角色在黑暗中找到觉醒的契机，挣扎反抗后获得救赎。', phases: ['陷入困境','沉沦黑暗','觉醒契机','挣扎反抗','最终救赎'], promptBlock: '即使在最深的黑暗中，角色心中仍有一丝光明在等待觉醒。', suggestTones: ['melancholy','cozy'] },
    { id: 'revenge', name: '复仇记', source: 'Booker / 曹禺', summary: '仇恨为动力，隐忍谋划后展开行动，但复仇之路往往伴随着沉重的代价。', phases: ['仇恨根源','隐忍计划','行动开始','得手快感','连锁反应','代价与反思'], promptBlock: '仇恨的种子已经种下，角色正在为复仇之路付出代价。', suggestTones: ['dark','suspenseful'] },
    { id: 'love_triangle', name: '三角困局', source: 'Polti《三十六种戏剧情境》', summary: '情感纠葛中的艰难抉择——平静被打破，三人之间的关系陷入复杂的困局。', phases: ['平静相处','第三人出现','情感摇摆','矛盾激化','痛苦抉择','结局'], promptBlock: '情感的纠葛正在酝酿，角色们在复杂的关系中寻找出路。', suggestTones: ['melancholy','passionate'] },
    { id: 'mystery', name: '迷案侦探', source: 'Polti / 阿加莎·克里斯蒂', summary: '一起谜案引发的抽丝剥茧——线索、推理、真相的逐步揭示。', phases: ['案发','初步调查','收集线索','关键突破','真相对峳','真相大白'], promptBlock: '谜团笼罩着这个世界，每一个细节都可能藏着关键线索。', suggestTones: ['suspenseful','dark'] },
    { id: 'faction_struggle', name: '派系纷争', source: 'Polti / 莎士比亚', summary: '多方势力在利益交织中博弈，平衡被打破后冲突不可避免。', phases: ['力量平衡','暗流涌动','冲突爆发','拉锯混战','关键转折','新秩序'], promptBlock: '势力的博弈正在加剧，每一次选择都可能改变力量的平衡。', suggestTones: ['epic','dark'] },
  ];

  // ========== 成就定义 ==========
  const ACHIEVEMENT_DEFS = {
    // ─── 生存类 ───
    'survival_10':  { id:'survival_10',  title:'初来乍到',   desc:'生存了10轮',       icon:'🌱', type:'survival',   check:'round', threshold:10, autoUnlock:true },
    'survival_50':  { id:'survival_50',  title:'老油条',     desc:'50轮还没死',       icon:'🌿', type:'survival',   check:'round', threshold:50, autoUnlock:true },
    'survival_100': { id:'survival_100', title:'百战余生',   desc:'100轮风雨',         icon:'🌳', type:'survival',   check:'round', threshold:100, autoUnlock:true },
    'survival_200': { id:'survival_200', title:'久经风霜',   desc:'生存200轮',         icon:'🛡️', type:'survival',   check:'round', threshold:200, autoUnlock:true },
    'survival_300': { id:'survival_300', title:'不死小强',   desc:'300轮不倒',         icon:'🦗', type:'survival',   check:'round', threshold:300, autoUnlock:true },
    'survival_500': { id:'survival_500', title:'传说级存在', desc:'500轮',             icon:'🌲', type:'survival',   check:'round', threshold:500, autoUnlock:true },
    'survival_750': { id:'survival_750', title:'永恒存在',   desc:'750轮',             icon:'♾️', type:'survival',   check:'round', threshold:750, autoUnlock:true },
    'survival_1000':{ id:'survival_1000',title:'不朽者',     desc:'1000轮',            icon:'🏔️', type:'survival',   check:'round', threshold:1000, autoUnlock:true },
    'near_death_1': { id:'near_death_1', title:'命悬一线',   desc:'第一次重伤濒死',     icon:'💀', type:'survival',   check:'evolve' },
    'near_death_3': { id:'near_death_3', title:'九命猫',     desc:'三次濒死却不死',     icon:'🐱', type:'survival',   check:'evolve' },
    'heal_crit':    { id:'heal_crit',    title:'大难不死',   desc:'从致命伤中完全康复',  icon:'🩹', type:'survival',   check:'evolve' },
    // ─── 战斗类 ───
    'first_kill':   { id:'first_kill',   title:'染血之手',   desc:'第一次夺走生命',     icon:'🔪', type:'combat',     check:'evolve' },
    'kill_5':       { id:'kill_5',       title:'五杀',       desc:'击杀5个敌人',       icon:'🔪', type:'combat',     check:'internal' },
    'kill_10':      { id:'kill_10',      title:'屠戮者',     desc:'亲手了结10个敌人',   icon:'⚔️', type:'combat',     check:'evolve' },
    'kill_50':      { id:'kill_50',      title:'浴血修罗',   desc:'50次击杀',          icon:'💀', type:'combat',     check:'evolve' },
    'kill_100':     { id:'kill_100',     title:'万人敌',     desc:'百人斩',            icon:'☠️', type:'combat',     check:'evolve' },
    'kill_200':     { id:'kill_200',     title:'屠戮魔王',   desc:'击杀200人',         icon:'👹', type:'combat',     check:'internal' },
    'kill_500':     { id:'kill_500',     title:'千人斩',     desc:'击杀500人',         icon:'⚔️', type:'combat',     check:'internal' },
    'first_boss':   { id:'first_boss',   title:'屠龙者',     desc:'击败第一个强大对手', icon:'🐉', type:'combat',     check:'evolve' },
    'first_injury': { id:'first_injury', title:'第一道伤疤', desc:'第一次在战斗中受伤', icon:'🩹', type:'combat',     check:'evolve' },
    'backstab':     { id:'backstab',     title:'背刺大师',   desc:'第一次偷袭成功',     icon:'🗡️', type:'combat',     check:'evolve' },
    'no_hit':       { id:'no_hit',       title:'毫发无伤',   desc:'无伤击败敌人',       icon:'🛡️', type:'combat',     check:'evolve' },
    'one_shot':     { id:'one_shot',     title:'一击必杀',   desc:'一招击败敌人',       icon:'💥', type:'combat',     check:'evolve' },
    'win_5':        { id:'win_5',        title:'五连胜',     desc:'达成5连胜',         icon:'🔥', type:'combat',     check:'internal' },
    'win_10':       { id:'win_10',       title:'十连胜',     desc:'达成10连胜',        icon:'💫', type:'combat',     check:'internal' },
    'win_20':       { id:'win_20',       title:'不败神话',   desc:'达成20连胜',        icon:'👑', type:'combat',     check:'internal' },
    'comeback':     { id:'comeback',     title:'绝地反杀',   desc:'濒死状态下翻盘',     icon:'↩️', type:'combat',     check:'evolve' },
    'first_defeat': { id:'first_defeat', title:'初尝败绩',   desc:'第一次被击败',       icon:'😵', type:'combat',     check:'evolve' },
    // ─── 亲密类(NSFW) ───
    'first_kiss':   { id:'first_kiss',   title:'初吻',       desc:'唇与唇的第一次触碰', icon:'💕', type:'intimate',   nsfw:true, check:'evolve' },
    'first_sex':    { id:'first_sex',    title:'禁果初尝',   desc:'第一次亲密接触',     icon:'💋', type:'intimate',   nsfw:true, check:'evolve' },
    'intimate_10':  { id:'intimate_10',  title:'情场老手',   desc:'10次云雨之欢',       icon:'🌹', type:'intimate',   nsfw:true, check:'evolve' },
    'first_heartbreak':{ id:'first_heartbreak', title:'心碎时刻', desc:'第一次被拒绝/背叛', icon:'💔', type:'intimate', check:'evolve' },
    'first_confess':{ id:'first_confess',title:'勇敢的心',   desc:'第一次表白',         icon:'💌', type:'intimate',   check:'evolve' },
    // ─── 奇葩类 ───
    'first_shit':   { id:'first_shit',   title:'人有三急',   desc:'第一次在世界上上厕所', icon:'🚽', type:'quirky',   check:'evolve' },
    'first_fart':   { id:'first_fart',   title:'泄气',       desc:'重要场合放屁',       icon:'💨', type:'quirky',   check:'evolve' },
    'first_hangover':{ id:'first_hangover',title:'宿醉',     desc:'第一次喝到断片',     icon:'🍺', type:'quirky',   check:'evolve' },
    'naked_run':    { id:'naked_run',    title:'裸奔者',     desc:'光天化日下裸奔',     icon:'🏃', type:'quirky',   check:'evolve' },
    'drunk_confess':{ id:'drunk_confess',title:'酒后吐真言', desc:'喝醉后说出秘密',     icon:'🍻', type:'quirky',   check:'evolve' },
    'wrong_name':   { id:'wrong_name',   title:'社死现场',   desc:'叫错了重要人物的名字', icon:'😱', type:'quirky',   check:'evolve' },
    'public_fall':  { id:'public_fall',  title:'平地摔',     desc:'在平路上摔了一跤',   icon:'🤦', type:'quirky',   check:'evolve' },
    'food_poison':  { id:'food_poison',  title:'食物中毒',   desc:'吃坏了肚子',         icon:'🤢', type:'quirky',   check:'evolve' },
    // ─── 探索类 ───
    'first_location':{ id:'first_location', title:'探索者',  desc:'到达第一个新地点',   icon:'🗺️', type:'exploration', check:'evolve' },
    'location_10':  { id:'location_10',  title:'行万里路',   desc:'到讵过10个不同地点', icon:'🌍', type:'exploration', check:'evolve' },
    'location_50':  { id:'location_50',  title:'地理学家',   desc:'到讵过50个地点',     icon:'🌍', type:'exploration', check:'evolve' },
    'first_treasure':{ id:'first_treasure', title:'寻宝者',  desc:'找到了宝藏',         icon:'💰', type:'exploration', check:'evolve' },
    'first_secret': { id:'first_secret', title:'秘密发现者', desc:'发现不为人知的秘密', icon:'🔍', type:'exploration', check:'evolve' },
    'first_dungeon':{ id:'first_dungeon',title:'深入险境',   desc:'探索了危险之地',     icon:'🏚️', type:'exploration', check:'evolve' },
    // ─── 社交类 ───
    'first_ally':   { id:'first_ally',   title:'第一个朋友', desc:'与某人建立了友谊',   icon:'🤝', type:'social',     check:'evolve' },
    'first_enemy':  { id:'first_enemy',  title:'树敌',       desc:'有人对你恨之入骨',   icon:'👿', type:'social',     check:'evolve' },
    'first_faction':{ id:'first_faction',title:'站队',       desc:'加入了某个势力',     icon:'🏛️', type:'social',     check:'evolve' },
    'first_betray': { id:'first_betray', title:'背叛之痛',   desc:'被信任的人背叛',     icon:'🗡️', type:'social',     check:'evolve' },
    'first_mercy':  { id:'first_mercy',  title:'慈悲为怀',   desc:'放过了求你命的敌人', icon:'🕊️', type:'social',     check:'evolve' },
    'ally_10':      { id:'ally_10',      title:'社交达人',   desc:'结交10个朋友',       icon:'👥', type:'social',     check:'evolve' },
    'sworn_bro':    { id:'sworn_bro',    title:'结拜兄弟',   desc:'与人结拜为兄弟/姐妹', icon:'🍻', type:'social',   check:'evolve' },
    'master_appr':  { id:'master_appr',  title:'拜师学艺',   desc:'拜师或收徒',         icon:'📚', type:'social',     check:'evolve' },
    // ─── 剧情类 ───
    'first_quest':  { id:'first_quest',  title:'任务启程',   desc:'接受第一个任务',     icon:'📜', type:'story',      check:'evolve' },
    'quest_complete':{ id:'quest_complete',title:'使命达成', desc:'完成重要剧情线',       icon:'🎯', type:'story',      check:'evolve' },
    'first_death':  { id:'first_death',  title:'死亡体验',   desc:'第一次死亡',         icon:'👻', type:'story',      check:'evolve' },
    'story_climax': { id:'story_climax', title:'命运转折',   desc:'故事主线达到高潮',   icon:'⚡', type:'story',      check:'evolve' },
    'plot_twist':   { id:'plot_twist',   title:'剧情反转',   desc:'经历了一次剧情反转', icon:'🔄', type:'story',      check:'evolve' },
    // ─── 成长类 ───
    'first_magic':  { id:'first_magic',  title:'初涉超凡',   desc:'第一次使用超凡能力', icon:'✨', type:'growth',     check:'evolve' },
    'first_craft':  { id:'first_craft',  title:'工匠精神',   desc:'亲手制作了第一件物品', icon:'🔨', type:'growth',  check:'evolve' },
    'first_wealth': { id:'first_wealth', title:'第一桶金',   desc:'获得第一笔可观财富', icon:'💰', type:'growth',     check:'evolve' },
    'first_trade':  { id:'first_trade',  title:'市井交易',   desc:'完成第一次交易',     icon:'🛒', type:'growth',     check:'evolve' },
    'first_breakthrough':{ id:'first_breakthrough',title:'突破',desc:'实力突破了原有境界',icon:'💥', type:'growth', check:'evolve' },
    // ─── 世界联动类 ───
    'first_bloodfeud':{ id:'first_bloodfeud', title:'血仇烙印', desc:'与某人/势力结下血仇', icon:'🩸', type:'world', check:'evolve' },
    'first_event': { id:'first_event',   title:'风云见证',   desc:'目击了世界事件爆发', icon:'🌋', type:'world',     check:'evolve' },
    'event_5':     { id:'event_5',       title:'风暴中心',   desc:'亲历5次世界事件',   icon:'🌀', type:'world',     check:'evolve' },
    'law_change':  { id:'law_change',    title:'规则改变者', desc:'改变了世界法则',     icon:'📜', type:'world',     check:'evolve' },
    // ─── 彩蛋/元类 ───
    'meta_achievement':{ id:'meta_achievement', title:'成就猎手', desc:'解锁了10个成就', icon:'🎯', type:'meta',   check:'internal' },
    'achieve_25':  { id:'achieve_25',    title:'成就收集者', desc:'解锁25个成就',       icon:'🎯', type:'meta',     check:'internal' },
    'achieve_50':  { id:'achieve_50',    title:'收集狂',     desc:'解锁50个成就',       icon:'🏆', type:'meta',     check:'internal' },
    'achieve_100': { id:'achieve_100',   title:'百成就',     desc:'解锁100个成就',       icon:'💯', type:'meta',     check:'internal' },
  };

  function getDefaultState() {
    return {
      round: 0,
      worldDigest: '世界正在苏醒，一切尚未可知。',
      events: [],
      factions: [],
      winds: [],
      worldTrends: [],
      reputation: {
        authority: '默默无闻',
        common: '默默无闻',
        shadow: '默默无闻',
        circuit: '默默无闻',
        lastChange: ''
      },
      economy: {
        climate: '平稳',
        signals: []
      },
      memories: [],
      enemies: [],
      influenceChain: [],
      regionalIncident: {
        active: false,
        title: '',
        type: '',
        scope: '',
        impact: '',
        cooldown: 0,
        _retry: false,
        _retryType: ''
      },
      blackbox: {
        secretActions: [],
        secretAssets: []
      },
      npcs: [],
      achievements: {
        unlocked: {}, autoGenerated: {}, progress: {},
        totalUnlocked: 0, lastAchievementRound: 0,
        showNSFW: false, autoGenEnabled: true, autoGenCount: 0, autoGenMaxPerChat: 50, lastCheckedRound: 0
      },
      combo: 0,
      comboHistory: [],
      worldLaws: {
        framework: 'custom', frameworkName: '自定义世界',
        dimensions: {}, customRules: [], derivedConstraints: [],
        presetName: null, lastAnalyzed: false, lastModifiedRound: 0
      },
      storyType: {
        template: null, tone: 'natural', customToneText: '',
        currentPhase: 0, phaseProgress: 0,
        protectedPhases: false, enablePhaseProgression: true
      },
      combat: {
        totalBattles: 0, totalKills: 0, totalDamageDealt: 0, totalDamageTaken: 0,
        wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0,
        favoriteWeapon: '', combatStyle: '未分类', lastBattleRound: 0,
        arenaKills: 0, bossesDefeated: [], log: []
      },
      emotionMap: {},
      inWorldMinutes: 0,
      worldTimeEpoch: 0,
      worldTimeLabel: '',
      lastTimeCheckRound: 0,
      timeLogs: [],
      globalPlotThreads: [],
      npcSchedules: {},
      achievementEchoes: [],
      characterLifecycles: {},
      worldTransitionLog: [],
      lastEvolveResult: null,
      lastInjection: null,
      lastUpdated: {}
    };
  }

  /** 获取当前扮演的角色名 */
  function getUserName() {
    try {
      const ctx = SillyTavern.getContext();
      if (ctx?.name1) return ctx.name1;
      if (ctx?.name2) return ctx.name2;
      const character = ctx?.characters?.[ctx?.characterId];
      if (character?.name) return character.name;
    } catch(e) {}
    return '用户';
  }

  /** UI 渲染：替换文本中的 {{user}} 为当前角色名 */
  function renderUserName(text) {
    if (!text || typeof text !== 'string') return text;
    const name = getUserName();
    return text.replace(/\{\{user\}\}/g, name);
  }

  function getChatId() {
    try {
      const ctx = SillyTavern.getContext();
      if (ctx && ctx.chatId) return ctx.chatId;
    } catch(e) {}
    return 'default';
  }

  function ensureArrays(state) {
    state.memories = state.memories || [];
    state.events = state.events || [];
    if (state.events) {
      for (const ev of state.events) {
        if (ev.stageRound === undefined) ev.stageRound = 1;
        if (!ev.type || !EVENT_TYPES.includes(ev.type)) ev.type = 'conflict';
        if (ev.consecutiveFails === undefined) ev.consecutiveFails = 0;
        if (ev.stall === undefined) ev.stall = false;
        // 修复 stageRound>=9 未晋级的问题
        const successStage = EVENT_SUCCESS_STAGE[ev.type] || EVENT_SUCCESS_STAGE.conflict;
        const terminalStages = EVENT_TERMINAL_STAGES[ev.type] || EVENT_TERMINAL_STAGES.conflict;
        if (ev.stageRound >= 9 && !terminalStages.includes(ev.stage)) {
          const STAGES = EVENT_STAGE_ORDER[ev.type] || EVENT_STAGE_ORDER.conflict;
          const idx = STAGES.indexOf(ev.stage);
          if (idx !== -1 && idx < STAGES.length - 1) {
            ev.stage = STAGES[idx + 1];
            ev.stageRound = ev.stageRound - 9 || 1;
          } else {
            ev.stage = successStage;
            ev.stageRound = 9;
          }
        }
        if (terminalStages.includes(ev.stage)) {
          ev.stageRound = 9;
          ev.stall = false;
        }
      }
    }
    state.factions = state.factions || [];
    const FACTION_RELATIONS = ['血盟', '盟友', '友好', '中立', '冷淡', '敌对', '世仇'];
    const FACTION_STATUSES = ['鼎盛', '稳固', '倾轧', '困顿', '衰落', '瓦解'];
    for (const f of state.factions) {
      f.status = FACTION_STATUSES.includes(f.status) ? f.status : '稳固';
      // 八级→七级迁移：旧存档的"紧张"归并到"冷淡"
      if (f.relation === '紧张') f.relation = '冷淡';
      f.relation = FACTION_RELATIONS.includes(f.relation) ? f.relation : '中立';
      f.scope = f.scope || '';
      if (!Array.isArray(f.powerPillars)) f.powerPillars = [];
      else f.powerPillars = f.powerPillars.map(p => {
        const name = typeof p === 'string' ? p : (p.name || '');
        return name.length > 4 ? name.slice(0, 4) : name;
      }).filter(Boolean);
      if (f.powerPillars.length > 3) f.powerPillars.length = 3;
    }
    state.worldTrends = state.worldTrends || [];
    if (state.worldTrends.length > 4) state.worldTrends.length = 4;
    state.winds = state.winds || [];
    state.winds = state.winds.map((wind, index) => {
      wind.topic = wind.topic || wind.content || `风声${index + 1}`;
      if (!['announcement', 'report', 'rumor', 'sentiment'].includes(wind.type)) wind.type = 'rumor';
      wind.level = Math.min(4, Math.max(1, parseInt(wind.level) || 1));
      wind.content = wind.content || '';
      wind.scope = wind.scope || '来源地';
      wind.source = wind.source || '来源不明';
      wind.quietRounds = Math.max(0, parseInt(wind.quietRounds) || 0);
      return wind;
    });
    state.reputation = state.reputation || { authority: '默默无闻', common: '默默无闻', shadow: '默默无闻', circuit: '默默无闻' };
    // 六级→五级迁移：旧存档的"小有名气"归并到"受人尊敬"
    for (const _dim of ['authority', 'common', 'shadow', 'circuit']) {
      if (state.reputation[_dim] === '小有名气') state.reputation[_dim] = '受人尊敬';
    }
    if (!state.reputation.lastChange) state.reputation.lastChange = '';
    state.economy = state.economy || { climate: '平稳', signals: [] };
    if (!state.economy.signals) state.economy.signals = [];
    state.enemies = state.enemies || [];
    state.influenceChain = Array.isArray(state.influenceChain) ? state.influenceChain : [];
    for (const influence of state.influenceChain) {
      if (influence && typeof influence === 'object' && influence._createdRound === undefined) {
        influence._createdRound = Number(state.round) || 0;
      }
    }
    if (!state.regionalIncident) {
      state.regionalIncident = { active: false, title: '', type: '', scope: '', impact: '', cooldown: 0, _retry: false, _retryType: '' };
    }
    state.regionalIncident.active = state.regionalIncident.active === true || state.regionalIncident.active === 'true';
    if (state.regionalIncident.cooldown === undefined) state.regionalIncident.cooldown = 0;
    if (state.regionalIncident.duration === undefined) state.regionalIncident.duration = 0;
    if (state.regionalIncident._retry === undefined) state.regionalIncident._retry = false;
    if (state.regionalIncident._retryType === undefined) state.regionalIncident._retryType = '';
    if (!state.blackbox) {
      state.blackbox = { secretActions: [], secretAssets: [] };
    } else {
      state.blackbox.secretActions = state.blackbox.secretActions || [];
      state.blackbox.secretAssets = state.blackbox.secretAssets || [];
    }
    // ========== NPC 系统 ==========
    state.npcs = Array.isArray(state.npcs) ? state.npcs : [];
    const NPC_STATUSES = ['active', 'injured', 'imprisoned', 'dead', 'retired', 'missing'];
    const NPC_HEALTHS = ['healthy', 'injured', 'critical', 'dead'];
    for (const npc of state.npcs) {
      if (!npc.name) npc.name = '未命名';
      npc.role = npc.role || '';
      npc.faction = npc.faction || '';
      if (!NPC_STATUSES.includes(npc.status)) npc.status = 'active';
      if (!NPC_HEALTHS.includes(npc.health)) npc.health = 'healthy';
      npc.traits = Array.isArray(npc.traits) ? npc.traits.slice(0, 4) : [];
      npc.abilities = Array.isArray(npc.abilities) ? npc.abilities : [];
      npc.location = npc.location || '';
      npc.goal = npc.goal || '';
      npc.firstSeen = Number.isFinite(Number(npc.firstSeen)) ? Number(npc.firstSeen) : (Number(state.round) || 0);
      npc.lastActive = Number.isFinite(Number(npc.lastActive)) ? Number(npc.lastActive) : (Number(state.round) || 0);
      npc.activityLog = Array.isArray(npc.activityLog) ? npc.activityLog.slice(0, 8) : [];
      npc.plotThreads = Array.isArray(npc.plotThreads) ? npc.plotThreads.slice(0, 5) : [];
      for (const pt of npc.plotThreads) {
        if (!pt.status || !['active', 'resolved', 'abandoned'].includes(pt.status)) pt.status = 'active';
        pt.since = Number.isFinite(Number(pt.since)) ? Number(pt.since) : (Number(state.round) || 0);
      }
      npc.relations = Array.isArray(npc.relations) ? npc.relations : [];
      npc.portrait = npc.portrait || '';
      npc.deathInfo = npc.deathInfo || null;
      // ★ NPC 扩展字段（角色画像合并）
      npc.personalityTags = Array.isArray(npc.personalityTags) ? npc.personalityTags : [];
      npc.keyEvents = Array.isArray(npc.keyEvents) ? npc.keyEvents.slice(-15) : [];
      npc.stats = npc.stats || { kills: 0, injuries: 0, travels: [], goldEarned: 0, questsCompleted: 0, conversationsWithPlayer: 0 };
      npc.combatStyle = npc.combatStyle || { rating: 0, style: '未分类', preferredWeapon: '', strengths: [], weaknesses: [] };
      npc.digest = npc.digest || '';
      npc.age = npc.age || 0;
      npc.race = npc.race || '未知';
      npc.gender = npc.gender || '未知';
      npc.ageStage = npc.ageStage || '成年';
      npc.occupation = npc.occupation || '未知';
      npc.icon = npc.icon || '👤';
      npc.customFields = npc.customFields || {};
    }
    if (state.npcs.length > 20) state.npcs.length = 20;
    // ========== 成就系统 ==========
    if (!state.achievements) state.achievements = {};
    var ach = state.achievements;
    if (!ach.unlocked) ach.unlocked = {};
    if (!ach.autoGenerated) ach.autoGenerated = {};
    if (!ach.progress) ach.progress = {};
    if (ach.totalUnlocked === undefined) ach.totalUnlocked = 0;
    if (ach.lastAchievementRound === undefined) ach.lastAchievementRound = 0;
    if (ach.showNSFW === undefined) ach.showNSFW = false;
    if (ach.autoGenEnabled === undefined) ach.autoGenEnabled = true;
    if (ach.autoGenCount === undefined) ach.autoGenCount = 0;
    if (ach.autoGenMaxPerChat === undefined) ach.autoGenMaxPerChat = 50;
    if (ach.lastCheckedRound === undefined) ach.lastCheckedRound = 0;
    if (state.combo === undefined) state.combo = 0;
    state.comboHistory = Array.isArray(state.comboHistory) ? state.comboHistory : [];
    state.achievementEchoes = Array.isArray(state.achievementEchoes) ? state.achievementEchoes : [];
    // ========== 世界法则 ==========
    if (!state.worldLaws) state.worldLaws = {};
    var wl = state.worldLaws;
    if (wl.framework === undefined) wl.framework = 'custom';
    if (wl.frameworkName === undefined) wl.frameworkName = '自定义世界';
    if (!wl.dimensions) wl.dimensions = {};
    WORLD_LAW_DIMENSIONS.forEach(function(d) {
      if (!wl.dimensions[d.id]) wl.dimensions[d.id] = { label: d.label, value: d.defaultVal, options: d.options };
      else { if (!wl.dimensions[d.id].label) wl.dimensions[d.id].label = d.label; if (!wl.dimensions[d.id].options) wl.dimensions[d.id].options = d.options; }
    });
    if (!wl.customRules) wl.customRules = [];
    if (!wl.derivedConstraints) wl.derivedConstraints = [];
    if (wl.presetName === undefined) wl.presetName = null;
    if (wl.lastAnalyzed === undefined) wl.lastAnalyzed = false;
    if (wl.lastModifiedRound === undefined) wl.lastModifiedRound = 0;
    // ========== 故事方向 ==========
    if (!state.storyType) state.storyType = {};
    var st = state.storyType;
    if (st.template === undefined) st.template = null;
    if (st.tone === undefined) st.tone = 'natural';
    if (st.customToneText === undefined) st.customToneText = '';
    if (st.currentPhase === undefined) st.currentPhase = 0;
    if (st.phaseProgress === undefined) st.phaseProgress = 0;
    if (st.protectedPhases === undefined) st.protectedPhases = false;
    if (st.enablePhaseProgression === undefined) st.enablePhaseProgression = true;
    // ========== 战斗系统 ==========
    if (!state.combat) state.combat = {};
    var ct = state.combat;
    if (ct.totalBattles === undefined) ct.totalBattles = 0;
    if (ct.totalKills === undefined) ct.totalKills = 0;
    if (ct.totalDamageDealt === undefined) ct.totalDamageDealt = 0;
    if (ct.totalDamageTaken === undefined) ct.totalDamageTaken = 0;
    if (ct.wins === undefined) ct.wins = 0;
    if (ct.losses === undefined) ct.losses = 0;
    if (ct.currentStreak === undefined) ct.currentStreak = 0;
    if (ct.bestStreak === undefined) ct.bestStreak = 0;
    if (ct.worstStreak === undefined) ct.worstStreak = 0;
    if (ct.favoriteWeapon === undefined) ct.favoriteWeapon = '';
    if (ct.combatStyle === undefined) ct.combatStyle = '未分类';
    if (ct.lastBattleRound === undefined) ct.lastBattleRound = 0;
    if (ct.arenaKills === undefined) ct.arenaKills = 0;
    if (!Array.isArray(ct.bossesDefeated)) ct.bossesDefeated = [];
    if (!Array.isArray(ct.log)) ct.log = [];
    // ========== 情感/时间/日程/线索/生命周期 ==========
    state.emotionMap = state.emotionMap || {};
    state.inWorldMinutes = state.inWorldMinutes || 0;
    state.worldTimeEpoch = state.worldTimeEpoch !== undefined ? state.worldTimeEpoch : 0;
    state.worldTimeLabel = state.worldTimeLabel || '';
    state.lastTimeCheckRound = state.lastTimeCheckRound || 0;
    state.timeLogs = Array.isArray(state.timeLogs) ? state.timeLogs : [];
    state.globalPlotThreads = Array.isArray(state.globalPlotThreads) ? state.globalPlotThreads : [];
    for (var gpt = 0; gpt < state.globalPlotThreads.length; gpt++) {
      var thr = state.globalPlotThreads[gpt];
      if (!thr.id) thr.id = 'pt_' + Date.now().toString(36) + '_' + gpt;
      thr.progress = Math.min(100, Math.max(0, thr.progress || 0));
      if (!thr.status || !['active','completed','frozen','abandoned'].includes(thr.status)) thr.status = 'active';
      if (!Array.isArray(thr.milestones)) thr.milestones = [];
      if (!Array.isArray(thr.participants)) thr.participants = [];
      if (!Array.isArray(thr.relatedFactions)) thr.relatedFactions = [];
      if (!Array.isArray(thr.connectedEventNames)) thr.connectedEventNames = [];
    }
    if (state.globalPlotThreads.length > 30) state.globalPlotThreads.length = 30;
    state.npcSchedules = state.npcSchedules || {};
    state.characterLifecycles = state.characterLifecycles || {};
    state.worldTransitionLog = Array.isArray(state.worldTransitionLog) ? state.worldTransitionLog : [];
    state.lastInjection = state.lastInjection || null;
    return state;
  }

  function loadState() {
    const chatId = getChatId();
    const key = STORAGE_PREFIX + chatId;
    const raw = window.WORLD_ENGINE_STORE.getItem(key);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        const def = getDefaultState();
        const merged = { ...def, ...saved };
        merged.memories = saved.memories || [];
        merged.lastInjection = saved.lastInjection || null;
        return ensureArrays(merged);
      } catch(e) { console.warn('[世界引擎] 加载状态失败', e); }
    }
    return ensureArrays(getDefaultState());
  }

  /** 是否存在真实落盘的当前状态；loadState() 在不存在时只返回临时默认状态。 */
  function hasState() {
    return window.WORLD_ENGINE_STORE.getItem(STORAGE_PREFIX + getChatId()) !== null;
  }

  function saveState(state) {
    const chatId = getChatId();
    const key = STORAGE_PREFIX + chatId;
    ensureArrays(state);
    state.lastUpdated = { chatId, timestamp: Date.now() };
    window.WORLD_ENGINE_STORE.setItem(key, JSON.stringify(state));
  }

  function clearState() {
    window.WORLD_ENGINE_STORE.removeItem(STORAGE_PREFIX + getChatId());
  }

  /** 保存状态并记录当前对话层数（evolve 完成后调用） */
  function saveStateWithLayer(state) {
    state.chatLayer = getChatLayer();
    saveState(state);
  }

  // ========== 存档点系统（a/b 双状态） ==========
  // a = 存档点，每次新对话轮次时复制 b
  // b = 工作区，UI 显示这个

  function getCheckpointKey() {
    return STORAGE_PREFIX + getChatId() + '_checkpoint';
  }

  function getAnchorLayerKey() {
    return STORAGE_PREFIX + getChatId() + '_anchorLayer';
  }

  function getFingerprintKey() {
    return STORAGE_PREFIX + getChatId() + '_fingerprint';
  }

  /** 保存存档点 a（完整复制当前 state） */
  function saveCheckpoint(state) {
    const key = getCheckpointKey();
    const cp = JSON.parse(JSON.stringify(state));
    ensureArrays(cp);
    window.WORLD_ENGINE_STORE.setItem(key, JSON.stringify(cp));
  }

  /** 从存档点 a 恢复状态 */
  function restoreCheckpoint() {
    const key = getCheckpointKey();
    const raw = window.WORLD_ENGINE_STORE.getItem(key);
    if (raw) {
      try {
        const cp = JSON.parse(raw);
        return ensureArrays(cp);
      } catch(e) { console.warn('[世界引擎] 存档点读取失败', e); }
    }
    return null;
  }

  /** 删除存档点 */
  function clearCheckpoint() {
    window.WORLD_ENGINE_STORE.removeItem(getCheckpointKey());
  }

  /** 旧版独立锚点接口（层数语义统一为 chat.length - 1；当前计数不使用它）。 */
  function getAnchorLayer() {
    const saved = window.WORLD_ENGINE_STORE.getItem(getAnchorLayerKey());
    return saved !== null ? Number(saved) : null;
  }

  /** 设置计数锚点 */
  function setAnchorLayer(l) {
    window.WORLD_ENGINE_STORE.setItem(getAnchorLayerKey(), String(l));
  }

  /** 获取当前对话层数（从 0 开始计数） */
  function getChatLayer() {
    try {
      const ctx = SillyTavern.getContext();
      const chat = ctx?.chat || [];
      return Math.max(0, chat.length - 1);
    } catch(e) { return 0; }
  }

  /** 获取当前对话的指纹（对话层数，用于判断是否重roll） */
  function getChatFingerprint() {
    return String(getChatLayer());
  }

  /** 保存指纹到 localStorage */
  function saveFingerprint(fp) {
    window.WORLD_ENGINE_STORE.setItem(getFingerprintKey(), fp);
  }

  /** 读取上次保存的指纹 */
  function loadFingerprint() {
    return window.WORLD_ENGINE_STORE.getItem(getFingerprintKey()) || '';
  }

  /** 判断是否为新对话轮次（指纹变了 → 新轮次；没变 → 重roll） */
  function isNewRound() {
    const oldFp = loadFingerprint();
    const newFp = getChatFingerprint();
    if (!oldFp) return true;
    return oldFp !== newFp;
  }

  function addMemory(state, memory) {
    if (!state) return;
    state.memories.unshift(memory);
    if (state.memories.length > 200) state.memories.pop();
    saveState(state);
  }

  // 输入输出过滤器：按 settings.evolveFilterRegex（每行一条正则）把匹配内容删掉。
  // 用于喂后台推演前清洗对话文本（思维链、状态栏、HTML 等）。
  function filterDialogue(text, settings) {
    if (!text) return text || '';
    const raw = (settings && settings.evolveFilterRegex) || '';
    if (!raw.trim()) return text;
    let out = text;
    for (const line of raw.split('\n')) {
      const pat = line.trim();
      if (!pat) continue;
      try { out = out.replace(new RegExp(pat, 'g'), ''); } catch (e) {}
    }
    return out;
  }

  // ========== 故事时间解析（按时间推演模式用） ==========
  // 中文数字 → 阿拉伯数字（阿拉伯数字原样返回，空 → 0）
  function cnToNum(s) {
    if (s == null) return 0;
    s = String(s).trim();
    if (s === '') return 0;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    const D = { 零:0, 〇:0, 一:1, 二:2, 两:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9 };
    s = s.replace(/^初/, '');               // 初九 → 九
    // 含「万」：拆高低两段递归（万前空按 1 算，即「万」=10000）
    if (s.includes('万')) {
      const idx = s.indexOf('万');
      return cnToNum(s.slice(0, idx) || '一') * 10000 + cnToNum(s.slice(idx + 1));
    }
    // 廿/卅 简写：廿=20、廿三=23、廿十=20（后接非个位忽略）
    if (s.includes('廿')) return 20 + (D[s.replace('廿', '')] || 0);
    if (s.includes('卅')) return 30 + (D[s.replace('卅', '')] || 0);
    // 千/百/十 位值 + 个位（零作占位跳过）：一千二百=1200、二十七=27、十一=11
    let total = 0, num = 0;
    const UNIT = { 十:10, 百:100, 千:1000 };
    for (const ch of s) {
      if (ch === '零' || ch === '〇') continue;
      if (D[ch] != null) num = D[ch];
      else if (UNIT[ch] != null) { total += (num === 0 ? 1 : num) * UNIT[ch]; num = 0; }
    }
    total += num;
    // 整段没解析出任何中文数字 → 阿拉伯兜底
    if (total === 0 && !/[零〇一二两三四五六七八九十百千]/.test(s)) {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    }
    return total;
  }

  // 模块级：最近一次从正文解析到的故事天数（供 UI「本轮对话时间」回显）
  let _lastStoryDay = null;
  function getLastStoryDay() { return _lastStoryDay; }
  function setLastStoryDay(v) { _lastStoryDay = (v == null ? null : Number(v)); }

  /**
   * 从正文按设置解析故事「总天数」。解析不到返回 null。
   * 规则：取窗口（前 front 字 + 后 back 字，都 0 则全文）→ 用 6 框拼正则
   * （奇数框非空成捕获组，偶数框字面量）→ 取最后一个匹配 → 各捕获组 cnToNum × 乘数求和。
   */
  function parseStoryDay(text, settings) {
    if (!text || !settings) return null;
    const front = Math.max(0, parseInt(settings.evolveTimeFront) || 0);
    const back = Math.max(0, parseInt(settings.evolveTimeBack) || 0);
    let win;
    if (front === 0 && back === 0) win = text;
    else win = (front > 0 ? text.slice(0, front) : '') + '\n' + (back > 0 ? text.slice(-back) : '');

    const boxes = [1, 2, 3, 4, 5, 6].map(i => settings['evolveTimeRe' + i] || '');
    const muls = [
      parseFloat(settings.evolveTimeMul1),
      parseFloat(settings.evolveTimeMul2),
      parseFloat(settings.evolveTimeMul3)
    ];
    let pattern = '';
    const activeMuls = [];
    for (let i = 0; i < 6; i++) {
      const b = boxes[i];
      if (i % 2 === 0) {                      // 数字框 1/3/5
        if (b) { pattern += '(' + b + ')'; activeMuls.push(muls[i / 2]); }
      } else {                               // 单位框 2/4/6（字面量，可空）
        pattern += b;
      }
    }
    if (!pattern || activeMuls.length === 0) return null;

    let re;
    try { re = new RegExp(pattern, 'g'); } catch (e) { return null; }
    let m, last = null;
    while ((m = re.exec(win)) !== null) {
      last = m;
      if (m.index === re.lastIndex) re.lastIndex++;   // 防零宽死循环
    }
    if (!last) return null;

    let total = 0;
    for (let k = 0; k < activeMuls.length; k++) {
      const mul = Number.isFinite(activeMuls[k]) ? activeMuls[k] : 0;
      total += cnToNum(last[k + 1]) * mul;
    }
    return total;
  }

  function ensureEventFields(ev) {
    if (!ev.type || !EVENT_TYPES.includes(ev.type)) ev.type = 'conflict';
    if (ev.stageRound === undefined) ev.stageRound = 1;
    if (ev.level === undefined) ev.level = 1;
    if (ev.consecutiveFails === undefined) ev.consecutiveFails = 0;
    if (ev.stall === undefined) ev.stall = false;
    // 阶段常量
    const STAGES = EVENT_STAGE_MAP[ev.type] || EVENT_STAGE_MAP.conflict;
    const stageOrder = EVENT_STAGE_ORDER[ev.type] || EVENT_STAGE_ORDER.conflict;
    const successStage = EVENT_SUCCESS_STAGE[ev.type] || EVENT_SUCCESS_STAGE.conflict;
    const terminalStages = EVENT_TERMINAL_STAGES[ev.type] || EVENT_TERMINAL_STAGES.conflict;
    if (!ev.stage || !STAGES.includes(ev.stage)) ev.stage = STAGES[0];
    // stageRound >= 9 自动晋级
    if (ev.stageRound >= 9 && !terminalStages.includes(ev.stage)) {
      const idx = stageOrder.indexOf(ev.stage);
      if (idx !== -1 && idx < stageOrder.length - 1) {
        ev.stage = stageOrder[idx + 1];
        ev.stageRound = ev.stageRound - 9 || 1;
      } else {
        ev.stage = successStage;
        ev.stageRound = 9;
      }
    }
    // 终局阶段锁定 9/9
    if (terminalStages.includes(ev.stage)) {
      ev.stageRound = 9;
      ev.stall = false;
    }
    return ev;
  }

  function addEvent(state, event) {
    if (!state.events) state.events = [];
    ensureEventFields(event);
    const idx = state.events.findIndex(e => e.name === event.name);
    if (idx !== -1) {
      state.events[idx] = { ...state.events[idx], ...event };
      ensureEventFields(state.events[idx]);
    } else {
      state.events.unshift(event);
    }
    if (state.events.length > 16) state.events.pop();
    saveState(state);
  }

  function addFaction(state, faction) {
    if (!state.factions) state.factions = [];
    const FACTION_RELATIONS = ['血盟', '盟友', '友好', '中立', '冷淡', '敌对', '世仇'];
    const FACTION_STATUSES = ['鼎盛', '稳固', '倾轧', '困顿', '衰落', '瓦解'];
    if (!FACTION_STATUSES.includes(faction.status)) faction.status = '稳固';
    if (faction.relation === '紧张') faction.relation = '冷淡';
    if (!FACTION_RELATIONS.includes(faction.relation)) faction.relation = '中立';
    faction.scope = faction.scope || '';
    if (!Array.isArray(faction.powerPillars)) faction.powerPillars = [];
    else faction.powerPillars = faction.powerPillars.map(p => {
      const name = typeof p === 'string' ? p : (p.name || '');
      return name.length > 4 ? name.slice(0, 4) : name;
    }).filter(Boolean);
    if (faction.powerPillars.length > 3) faction.powerPillars.length = 3;
    const idx = state.factions.findIndex(f => f.name === faction.name);
    if (idx !== -1) {
      state.factions[idx] = { ...state.factions[idx], ...faction };
    } else {
      state.factions.unshift(faction);
    }
    if (state.factions.length > 15) state.factions.pop();
    saveState(state);
  }

  function addWorldTrend(state, trend) {
    if (!state.worldTrends) state.worldTrends = [];
    if (!trend || !trend.name) return;
    trend.status = trend.status === '已结束' ? '已结束' : '持续中';
    trend.scope = trend.scope || '天下';
    trend.description = trend.description || '';
    trend.source = trend.source || '';
    const idx = state.worldTrends.findIndex(existing => existing.name === trend.name);
    if (idx !== -1) {
      if (state.worldTrends[idx].status === '已结束') trend.status = '已结束';
      state.worldTrends[idx] = { ...state.worldTrends[idx], ...trend };
    } else {
      state.worldTrends.unshift(trend);
      if (state.worldTrends.length > 4) state.worldTrends.length = 4;
    }
    saveState(state);
  }

  function addWind(state, wind) {
    if (!state.winds) state.winds = [];
    delete wind.quietRounds;
    wind.topic = wind.topic || wind.content || `风声${Date.now()}`;
    if (!['announcement', 'report', 'rumor', 'sentiment'].includes(wind.type)) wind.type = 'rumor';
    wind.level = Math.min(4, Math.max(1, parseInt(wind.level) || 1));
    wind.scope = wind.scope || '来源地';
    wind.source = wind.source || '来源不明';
    wind.quietRounds = 0;
    const idx = state.winds.findIndex(existing => existing.topic === wind.topic);
    if (idx !== -1) state.winds[idx] = { ...state.winds[idx], ...wind };
    else state.winds.unshift(wind);
    if (state.winds.length > 12) state.winds.pop();
    saveState(state);
  }

  // ========== NPC 系统辅助函数 ==========

  function addNpc(state, npc) {
    if (!state.npcs) state.npcs = [];
    if (!npc || !npc.name) return;
    const NPC_STATUSES = ['active', 'injured', 'imprisoned', 'dead', 'retired', 'missing'];
    const NPC_HEALTHS = ['healthy', 'injured', 'critical', 'dead'];
    if (!NPC_STATUSES.includes(npc.status)) npc.status = 'active';
    if (!NPC_HEALTHS.includes(npc.health)) npc.health = 'healthy';
    npc.traits = Array.isArray(npc.traits) ? npc.traits.slice(0, 4) : [];
    npc.abilities = Array.isArray(npc.abilities) ? npc.abilities : [];
    npc.activityLog = Array.isArray(npc.activityLog) ? npc.activityLog : [];
    npc.plotThreads = Array.isArray(npc.plotThreads) ? npc.plotThreads : [];
    npc.relations = Array.isArray(npc.relations) ? npc.relations : [];
    npc.firstSeen = Number.isFinite(Number(npc.firstSeen)) ? Number(npc.firstSeen) : (Number(state.round) || 0);
    npc.lastActive = Number(state.round) || 0;
    const idx = state.npcs.findIndex(n => n.name === npc.name);
    if (idx !== -1) {
      // 保留首次出场轮次和活动日志历史
      npc.firstSeen = state.npcs[idx].firstSeen;
      // 合并活动日志（去重按 round+action）
      const existingLog = state.npcs[idx].activityLog || [];
      const newLog = npc.activityLog || [];
      const logSet = new Set(existingLog.map(l => l.round + '|' + l.action));
      for (const entry of newLog) {
        if (!logSet.has(entry.round + '|' + entry.action)) existingLog.push(entry);
      }
      npc.activityLog = existingLog.slice(-8);
      // 合并剧情线索
      const existingThreads = state.npcs[idx].plotThreads || [];
      const newThreads = npc.plotThreads || [];
      const threadSet = new Set(existingThreads.map(t => t.thread));
      for (const t of newThreads) {
        if (!threadSet.has(t.thread)) existingThreads.push(t);
      }
      npc.plotThreads = existingThreads.slice(-5);
      state.npcs[idx] = { ...state.npcs[idx], ...npc };
    } else {
      state.npcs.unshift(npc);
    }
    if (state.npcs.length > 20) state.npcs.length = 20;
    saveState(state);
  }

  function addNpcActivity(state, npcName, action, source) {
    if (!state.npcs) return;
    const npc = state.npcs.find(n => n.name === npcName);
    if (!npc) return;
    npc.activityLog = npc.activityLog || [];
    npc.activityLog.push({ round: Number(state.round) || 0, action, source: source || '推演' });
    if (npc.activityLog.length > 8) npc.activityLog = npc.activityLog.slice(-8);
    npc.lastActive = Number(state.round) || 0;
  }

  function addNpcPlotThread(state, npcName, thread, status) {
    if (!state.npcs) return;
    const npc = state.npcs.find(n => n.name === npcName);
    if (!npc) return;
    npc.plotThreads = npc.plotThreads || [];
    const idx = npc.plotThreads.findIndex(p => p.thread === thread);
    if (idx !== -1) {
      npc.plotThreads[idx].status = status || npc.plotThreads[idx].status;
    } else {
      npc.plotThreads.push({ thread, status: status || 'active', since: Number(state.round) || 0 });
    }
    if (npc.plotThreads.length > 5) npc.plotThreads = npc.plotThreads.slice(-5);
  }

  function updateNpcLifecycle(state, npcName, newStatus, deathInfo) {
    if (!state.npcs) return;
    const npc = state.npcs.find(n => n.name === npcName);
    if (!npc) return;
    const NPC_STATUSES = ['active', 'injured', 'imprisoned', 'dead', 'retired', 'missing'];
    if (NPC_STATUSES.includes(newStatus)) npc.status = newStatus;
    if (newStatus === 'dead') {
      npc.health = 'dead';
      npc.deathInfo = deathInfo || { round: Number(state.round) || 0, cause: '未知', impact: '' };
    }
    if (newStatus === 'injured') npc.health = 'injured';
    npc.lastActive = Number(state.round) || 0;
  }

  // ========== 成就系统函数 ==========
  function unlockAchievement(state, achId, note) {
    if (!ACHIEVEMENT_DEFS[achId]) return false;
    if (!state.achievements) state.achievements = {};
    if (!state.achievements.unlocked) state.achievements.unlocked = {};
    if (state.achievements.unlocked[achId]) return false;
    state.combo = (state.combo || 0) + 1;
    var currentCombo = state.combo;
    var def = ACHIEVEMENT_DEFS[achId];
    state.achievements.unlocked[achId] = { round: state.round, timestamp: Date.now(), note: note || def.desc };
    state.achievements.totalUnlocked = (state.achievements.totalUnlocked || 0) + 1;
    state.achievements.lastAchievementRound = state.round;
    if (currentCombo >= 2) {
      state.comboHistory = state.comboHistory || [];
      var lastC = state.comboHistory.length > 0 ? state.comboHistory[state.comboHistory.length - 1] : null;
      if (!lastC || lastC.round !== state.round) {
        state.comboHistory.push({ combo: currentCombo, round: state.round || 0, timestamp: Date.now() });
        if (state.comboHistory.length > 50) state.comboHistory = state.comboHistory.slice(-50);
      } else { if (currentCombo > lastC.combo) lastC.combo = currentCombo; }
    }
    state._lastCombo = { combo: currentCombo, badge: getComboBadge(currentCombo) };
    addAchievementEcho(state, def.title || achId);
    return true;
  }

  function checkAutoAchievements(state, evolveResult) {
    if (!evolveResult || !evolveResult.achievements || !Array.isArray(evolveResult.achievements)) return [];
    if (!state.achievements || !state.achievements.autoGenEnabled) return [];
    var newly = [];
    for (var i = 0; i < evolveResult.achievements.length; i++) {
      var a = evolveResult.achievements[i];
      if (!a || !a.id) continue;
      if (ACHIEVEMENT_DEFS[a.id]) { if (unlockAchievement(state, a.id, a.note)) newly.push(a); continue; }
      if (a.id.indexOf('auto_') === 0) {
        var genCount = Object.keys(state.achievements.autoGenerated || {}).length;
        if (genCount >= (state.achievements.autoGenMaxPerChat || 50)) continue;
        if (!state.achievements.autoGenerated) state.achievements.autoGenerated = {};
        if (!state.achievements.autoGenerated[a.id]) {
          state.achievements.autoGenerated[a.id] = { id: a.id, title: a.title || a.id.replace('auto_', ''), desc: a.desc || '', note: a.note || '', icon: a.icon || '🎯', sourceRound: state.round, count: 1 };
          state.achievements.autoGenCount = (state.achievements.autoGenCount || 0) + 1;
          if (!state.achievements.unlocked) state.achievements.unlocked = {};
          if (!state.achievements.unlocked[a.id]) {
            state.achievements.unlocked[a.id] = { round: state.round, timestamp: Date.now(), note: a.note || a.desc || 'AI发现的成就' };
            state.achievements.totalUnlocked = (state.achievements.totalUnlocked || 0) + 1;
            newly.push(a);
          }
        } else { state.achievements.autoGenerated[a.id].count++; }
      }
    }
    return newly;
  }

  function checkAutoUnlockAchievements(state) {
    if (!state.achievements) return [];
    var newly = [], round = state.round;
    for (var key in ACHIEVEMENT_DEFS) {
      var def = ACHIEVEMENT_DEFS[key];
      if (def.autoUnlock && def.check === 'round' && def.threshold && round >= def.threshold && !state.achievements.unlocked[key]) {
        if (unlockAchievement(state, key, '')) newly.push(def);
      }
      if (def.check === 'internal' && key === 'meta_achievement' && (state.achievements.totalUnlocked || 0) >= 10 && !state.achievements.unlocked[key]) {
        if (unlockAchievement(state, key, '解锁了10个成就')) newly.push(def);
      }
      if (def.check === 'internal' && key === 'achieve_50' && (state.achievements.totalUnlocked || 0) >= 50 && !state.achievements.unlocked[key]) {
        if (unlockAchievement(state, key, '解锁了50个成就')) newly.push(def);
      }
      if (def.check === 'internal' && key === 'achieve_25' && (state.achievements.totalUnlocked || 0) >= 25 && !state.achievements.unlocked[key]) {
        if (unlockAchievement(state, key, '解锁了25个成就')) newly.push(def);
      }
      if (def.check === 'internal' && key === 'achieve_100' && (state.achievements.totalUnlocked || 0) >= 100 && !state.achievements.unlocked[key]) {
        if (unlockAchievement(state, key, '解锁了100个成就')) newly.push(def);
      }
    }
    return newly;
  }

  function checkCombatAchievements(state) {
    if (!state.achievements || !state.combat) return [];
    var newly = [], ct = state.combat;
    var totalKills = ct.totalKills || 0, bosses = ct.bossesDefeated ? ct.bossesDefeated.length : 0;
    if (totalKills >= 5 && !state.achievements.unlocked['kill_5']) { if (unlockAchievement(state, 'kill_5', '击杀5个敌人')) newly.push('kill_5'); }
    if (totalKills >= 200 && !state.achievements.unlocked['kill_200']) { if (unlockAchievement(state, 'kill_200', '击杀200人')) newly.push('kill_200'); }
    if (totalKills >= 500 && !state.achievements.unlocked['kill_500']) { if (unlockAchievement(state, 'kill_500', '击杀500人')) newly.push('kill_500'); }
    if ((ct.bestStreak || 0) >= 5 && !state.achievements.unlocked['win_5']) { if (unlockAchievement(state, 'win_5', '5连胜')) newly.push('win_5'); }
    if ((ct.bestStreak || 0) >= 10 && !state.achievements.unlocked['win_10']) { if (unlockAchievement(state, 'win_10', '10连胜')) newly.push('win_10'); }
    if ((ct.bestStreak || 0) >= 20 && !state.achievements.unlocked['win_20']) { if (unlockAchievement(state, 'win_20', '20连胜')) newly.push('win_20'); }
    return newly;
  }

  function checkHiddenAchievements(state) {
    if (!state.achievements) return [];
    var newly = [], ach = state.achievements, totalAch = ach.totalUnlocked || 0, round = state.round;
    if (!ach.unlocked['no_achieve'] && round >= 50 && totalAch === 0) {
      if (unlockAchievement(state, 'no_achieve', '50轮零成就')) newly.push('no_achieve');
    }
    if (!ach.unlocked['achieve_25'] && totalAch >= 25) {
      if (unlockAchievement(state, 'achieve_25', '25个成就')) newly.push('achieve_25');
    }
    return newly;
  }

  function getAchievementProgress(state, achId) {
    var def = ACHIEVEMENT_DEFS[achId];
    if (!def) return { current: 0, max: 0, pct: 0 };
    var current = 0, max = 0;
    if (def.type === 'survival') { max = def.threshold; current = Math.min(state.round || 0, max); }
    else if (def.type === 'combat' && /^kill_/.test(achId)) { current = Math.min((state.combat || {}).totalKills || 0, def.threshold || 100); max = def.threshold || 100; }
    else if (def.type === 'meta') { max = achId === 'meta_achievement' ? 10 : achId === 'achieve_50' ? 50 : achId === 'achieve_100' ? 100 : 25; current = Math.min(state.achievements ? state.achievements.totalUnlocked || 0 : 0, max); }
    else { current = (state.achievements && state.achievements.unlocked && state.achievements.unlocked[achId]) ? 1 : 0; max = 1; }
    return { current: current, max: max, pct: max > 0 ? Math.round((current / max) * 100) : 0 };
  }

  function getAchievementRarity(def) {
    if (!def) return 0;
    if (def.type === 'survival') { if ((def.threshold || 0) >= 1000) return 4; if ((def.threshold || 0) >= 500) return 3; if ((def.threshold || 0) >= 100) return 2; if ((def.threshold || 0) >= 50) return 1; return 0; }
    if (def.nsfw) return 0;
    if (def.type === 'meta') return 3;
    if (/100$|boss|end$|climax/.test(def.id || '')) return 3;
    if (def.type === 'story' || def.type === 'growth') return 2;
    return 1;
  }

  function addAchievementEcho(state, achievementName) {
    if (!state) return;
    if (!state.achievementEchoes) state.achievementEchoes = [];
    state.achievementEchoes.push({ name: achievementName, round: state.round || 0, timestamp: Date.now() });
    if (state.achievementEchoes.length > 5) state.achievementEchoes = state.achievementEchoes.slice(-5);
  }

  function getAchievementEchoes(state, maxCount) {
    maxCount = maxCount || 3;
    if (!state || !state.achievementEchoes) return [];
    return state.achievementEchoes.slice(-maxCount);
  }

  // ========== 情感状态机函数 ==========
  function applyEmotionState(emotionMap, entity, eventType) {
    if (!emotionMap) return;
    if (!emotionMap[entity]) emotionMap[entity] = { attitude: 0, emotion: 'NEUTRAL', lastInteraction: Date.now(), stateDuration: 0 };
    var em = emotionMap[entity];
    var transition = EMOTION_TRANSITIONS[eventType] || EMOTION_TRANSITIONS.default;
    var rand = Math.random(), cumulative = 0;
    em.prevEmotion = em.emotion;
    for (var stateName in transition) {
      cumulative += transition[stateName];
      if (rand <= cumulative) { em.emotion = stateName; em.stateDuration = 0; break; }
    }
    em.lastInteraction = Date.now();
    if (em.emotion === 'FRIENDLY' || em.emotion === 'JOYFUL') em.attitude = Math.min(10, (em.attitude || 0) + 0.5);
    else if (em.emotion === 'ANGRY' || em.emotion === 'ANNOYED' || em.emotion === 'FEARFUL') em.attitude = Math.max(-10, (em.attitude || 0) - 0.5);
    return em;
  }

  function decayEmotionStates(emotionMap) {
    if (!emotionMap) return;
    for (var name in emotionMap) {
      var em = emotionMap[name];
      em.stateDuration = (em.stateDuration || 0) + 1;
      if (em.stateDuration > 5 && em.emotion !== 'NEUTRAL') { em.emotion = 'NEUTRAL'; em.stateDuration = 0; }
      if (em.attitude > 0) em.attitude = Math.max(0, em.attitude - 0.2);
      else if (em.attitude < 0) em.attitude = Math.min(0, em.attitude + 0.2);
    }
  }

  function getEmotionStateSummary(emotionMap) {
    if (!emotionMap) return '';
    var parts = [];
    for (var name in emotionMap) {
      var em = emotionMap[name];
      var stateInfo = EMOTION_STATES[em.emotion] || EMOTION_STATES.NEUTRAL;
      parts.push(name + ':' + stateInfo.name + '(' + em.attitude + ')');
    }
    return parts.join(' | ');
  }

  function getEmotionSummary(state, limit) {
    limit = limit || 5;
    if (!state.emotionMap) return '无';
    var entries = Object.entries(state.emotionMap);
    var attitudeOrder = { '敌意': 0, '不共戴天': 0, '警惕': 1, '信任': 2, '友善': 3, '友好': 3, '中立': 4 };
    entries.sort(function(a, b) { return (attitudeOrder[a[1].attitude] || 5) - (attitudeOrder[b[1].attitude] || 5); });
    return entries.slice(0, limit).map(function(e) { return e[0] + ':' + (e[1].attitude || '中立') + '(' + (e[1].level || '陌生') + ')'; }).join(', ') || '无';
  }

  // ========== 故事方向函数 ==========
  function getStoryPromptBlock(state) {
    if (!state || !state.storyType || !state.storyType.template) return '';
    var tmpl = null;
    for (var i = 0; i < STORY_TEMPLATES.length; i++) { if (STORY_TEMPLATES[i].id === state.storyType.template) { tmpl = STORY_TEMPLATES[i]; break; } }
    if (!tmpl) return '';
    var phaseIdx = state.storyType.currentPhase || 0;
    if (phaseIdx >= tmpl.phases.length) phaseIdx = tmpl.phases.length - 1;
    var phaseName = tmpl.phases[phaseIdx] || '';
    var toneName = 'natural';
    if (state.storyType.tone === 'custom' && state.storyType.customToneText) toneName = state.storyType.customToneText;
    else { for (var j = 0; j < EMOTIONAL_TONES.length; j++) { if (EMOTIONAL_TONES[j].id === state.storyType.tone) { toneName = EMOTIONAL_TONES[j].name; break; } } }
    return '【故事方向】\n📖 故事脉络：' + tmpl.name + ' → ' + phaseName + '\n💫 情感基调：' + toneName;
  }

  function advanceStoryPhase(state) {
    if (!state || !state.storyType || !state.storyType.template) return;
    if (state.storyType.enablePhaseProgression === false) return;
    if (state.round % 10 !== 0) return;
    var tmpl = null;
    for (var i = 0; i < STORY_TEMPLATES.length; i++) { if (STORY_TEMPLATES[i].id === state.storyType.template) { tmpl = STORY_TEMPLATES[i]; break; } }
    if (!tmpl) return;
    var maxPhase = tmpl.phases.length - 1;
    var nextPhase = (state.storyType.currentPhase || 0) + 1;
    if (nextPhase > maxPhase) nextPhase = maxPhase;
    state.storyType.currentPhase = nextPhase;
  }

  function getTemplateById(id) {
    for (var i = 0; i < STORY_TEMPLATES.length; i++) { if (STORY_TEMPLATES[i].id === id) return STORY_TEMPLATES[i]; }
    return null;
  }

  function getToneDisplayName(id) {
    if (id === 'natural') return '自然';
    if (id === 'custom') return '自定义';
    for (var i = 0; i < EMOTIONAL_TONES.length; i++) { if (EMOTIONAL_TONES[i].id === id) return EMOTIONAL_TONES[i].name; }
    return id;
  }

  // ========== 世界法则函数 ==========
  function applyWorldLawPreset(state, presetId) {
    var preset = null;
    for (var i = 0; i < WORLD_LAW_PRESETS.length; i++) { if (WORLD_LAW_PRESETS[i].id === presetId) { preset = WORLD_LAW_PRESETS[i]; break; } }
    if (!preset) return false;
    if (!state.worldLaws) state.worldLaws = {};
    state.worldLaws.framework = preset.id;
    state.worldLaws.frameworkName = preset.name;
    state.worldLaws.presetName = preset.name;
    var dims = {};
    WORLD_LAW_DIMENSIONS.forEach(function(d) { dims[d.id] = { label: d.label, value: preset.dimensions[d.id] || d.defaultVal, options: d.options }; });
    state.worldLaws.dimensions = dims;
    state.worldLaws.customRules = JSON.parse(JSON.stringify(preset.customRules));
    state.worldLaws.lastModifiedRound = state.round;
    saveState(state);
    return true;
  }

  function getWorldLawConstraintsArray(state) {
    if (!state.worldLaws) return [];
    var arr = [], wl = state.worldLaws;
    Object.keys(wl.dimensions || {}).forEach(function(k) { arr.push(wl.dimensions[k].label + '：' + wl.dimensions[k].value); });
    (wl.customRules || []).forEach(function(r) { if (r) arr.push('📜 ' + r); });
    (wl.derivedConstraints || []).forEach(function(c) { if (c) arr.push('⚖️ ' + c); });
    return arr;
  }

  function setWorldLawDimension(state, dimId, value) {
    if (!state.worldLaws || !state.worldLaws.dimensions || !state.worldLaws.dimensions[dimId]) return;
    state.worldLaws.dimensions[dimId].value = value;
    state.worldLaws.lastModifiedRound = state.round;
    if (state.worldLaws.framework !== 'custom') { state.worldLaws.framework = 'custom'; state.worldLaws.frameworkName = '自定义世界'; }
    saveState(state);
  }

  function addWorldLawCustomRule(state, ruleText) {
    if (!state.worldLaws || !ruleText || !ruleText.trim()) return;
    if (!state.worldLaws.customRules) state.worldLaws.customRules = [];
    state.worldLaws.customRules.push(ruleText.trim());
    state.worldLaws.lastModifiedRound = state.round;
    saveState(state);
  }

  function removeWorldLawCustomRule(state, index) {
    if (!state.worldLaws || !state.worldLaws.customRules || index < 0 || index >= state.worldLaws.customRules.length) return;
    state.worldLaws.customRules.splice(index, 1);
    state.worldLaws.lastModifiedRound = state.round;
    saveState(state);
  }

  function setWorldLawDerivedConstraints(state, constraints) {
    if (!state.worldLaws) state.worldLaws = {};
    state.worldLaws.derivedConstraints = (constraints || []).slice(0, 10);
    state.worldLaws.lastAnalyzed = true;
    state.worldLaws.lastModifiedRound = state.round;
  }

  // ========== 战斗系统 ==========

  function updateStreak(state, isWin) {
    if (!state.combat) return;
    if (isWin) {
      state.combat.currentStreak = state.combat.currentStreak >= 0 ? (state.combat.currentStreak || 0) + 1 : 1;
      if (state.combat.currentStreak > (state.combat.bestStreak || 0)) state.combat.bestStreak = state.combat.currentStreak;
    } else {
      state.combat.currentStreak = state.combat.currentStreak <= 0 ? (state.combat.currentStreak || 0) - 1 : -1;
      if (state.combat.currentStreak < (state.combat.worstStreak || 0)) state.combat.worstStreak = state.combat.currentStreak;
    }
  }

  function registerBossDefeat(state, bossName) {
    if (!bossName) return;
    if (!state.combat) state.combat = {};
    if (!state.combat.bossesDefeated) state.combat.bossesDefeated = [];
    for (var ri = 0; ri < state.combat.bossesDefeated.length; ri++) {
      if (state.combat.bossesDefeated[ri] === bossName) return;
    }
    state.combat.bossesDefeated.push(bossName);
  }

  function addCombatLog(state, entry) {
    if (!state.combat) state.combat = {};
    if (!state.combat.log) state.combat.log = [];
    entry.round = entry.round || state.round;
    entry.type = entry.type || 'pve';
    entry.participants = entry.participants || [];
    entry.outcome = entry.outcome || 'win';
    entry.kills = entry.kills || 0;
    entry.injuries = entry.injuries || [];
    entry.description = entry.description || '';
    entry.weapon = entry.weapon || '';
    entry.damageDealt = entry.damageDealt || 0;
    entry.damageTaken = entry.damageTaken || 0;
    entry.isBossFight = entry.isBossFight || false;
    entry.bossName = entry.bossName || '';
    entry.techniques = entry.techniques || [];
    entry.style = entry.style || '';
    entry.turnCount = entry.turnCount || 0;
    entry.timestamp = Date.now();
    state.combat.log.unshift(entry);
    if (state.combat.log.length > 50) state.combat.log.pop();
    state.combat.totalBattles = (state.combat.totalBattles || 0) + 1;
    state.combat.totalKills = (state.combat.totalKills || 0) + entry.kills;
    state.combat.totalDamageDealt = (state.combat.totalDamageDealt || 0) + entry.damageDealt;
    state.combat.totalDamageTaken = (state.combat.totalDamageTaken || 0) + entry.damageTaken;
    state.combat.lastBattleRound = state.round;
    if (entry.outcome === 'win') { state.combat.wins = (state.combat.wins || 0) + 1; updateStreak(state, true); }
    else if (entry.outcome === 'loss') { state.combat.losses = (state.combat.losses || 0) + 1; updateStreak(state, false); }
    if (entry.style) state.combat.combatStyle = entry.style;
    if (entry.type === 'arena') state.combat.arenaKills = (state.combat.arenaKills || 0) + entry.kills;
    if (entry.isBossFight && entry.bossName) registerBossDefeat(state, entry.bossName);
    if (entry.kills > 0 && entry.weapon) {
      var wc = {};
      for (var wi = 0; wi < state.combat.log.length; wi++) {
        var le = state.combat.log[wi]; if (le.weapon && le.kills > 0) wc[le.weapon] = (wc[le.weapon] || 0) + (le.kills || 0);
      }
      var bestW = '', bestC = 0;
      for (var w in wc) { if (wc[w] > bestC) { bestC = wc[w]; bestW = w; } }
      state.combat.favoriteWeapon = bestW;
    }
    saveState(state);
  }

  function getCombatStats(state) {
    if (!state.combat) return '无战斗记录';
    var ct = state.combat;
    var total = ct.totalBattles || 0;
    var wins = ct.wins || 0;
    var rate = total > 0 ? (wins / total * 100).toFixed(1) : '0.0';
    var streak = '';
    if (ct.currentStreak > 0) streak = '连胜' + ct.currentStreak + '场';
    else if (ct.currentStreak < 0) streak = '连败' + Math.abs(ct.currentStreak) + '场';
    else streak = '无连胜/连败';
    return '⚔️ 总战斗: ' + total + '场 | 胜率: ' + rate + '%\n击杀: ' + (ct.totalKills || 0) + '人 | BOSS: ' + (ct.bossesDefeated ? ct.bossesDefeated.length : 0) + '个\n伤害: 造成' + (ct.totalDamageDealt || 0) + ' / 承受' + (ct.totalDamageTaken || 0) + '\n最佳连胜: ' + (ct.bestStreak || 0) + '场 | 当前: ' + streak + '\n常用武器: ' + (ct.favoriteWeapon || '无') + ' | 风格: ' + (ct.combatStyle || '未分类');
  }

  function getCombatLog(state, limit) {
    if (!state.combat || !state.combat.log) return [];
    return state.combat.log.slice(0, limit || 10);
  }

  function getCombatSummary(state) {
    if (!state.combat) return '';
    var ct = state.combat;
    var total = ct.totalBattles || 0, wins = ct.wins || 0, losses = ct.losses || 0;
    var kills = ct.totalKills || 0, streak = ct.currentStreak || 0;
    var killRate = total > 0 ? kills / total : 0;
    var winRate = total > 0 ? wins / total : 0;
    var rating = Math.min(99, Math.floor(winRate * 40 + killRate * 15 + Math.min(Math.abs(streak), 10) * 2));
    var sl = streak > 0 ? '连胜' + streak + '场' : streak < 0 ? '连败' + Math.abs(streak) + '场' : '无连胜';
    return '玩家战绩：' + total + '战' + wins + '胜' + losses + '败，击杀' + kills + '人，当前' + sl + '，战力评级：' + rating;
  }

  // ========== 记忆冷热分离 ==========

  function extractTags(text) {
    if (!text || typeof text !== 'string') return [];
    var tags = [];
    var atMatches = text.match(/@[一-龥a-zA-Z0-9_\-]+/g);
    if (atMatches) tags = tags.concat(atMatches.map(function(t) { return t.substring(1).toLowerCase(); }));
    var hashMatches = text.match(/#[一-龥a-zA-Z0-9_\-]+/g);
    if (hashMatches) tags = tags.concat(hashMatches.map(function(t) { return t.substring(1).toLowerCase(); }));
    return tags.filter(function(t, i) { return tags.indexOf(t) === i; });
  }

  function searchMemory(state, query, options) {
    options = options || {};
    var maxResults = options.maxResults || 10;
    var filterTags = options.filterTags || null;
    var memories = state.memories || [];
    var candidateMemories = memories;
    if (filterTags && filterTags.length > 0) {
      var ftLower = filterTags.map(function(t) { return t.toLowerCase(); });
      candidateMemories = memories.filter(function(m) {
        if (!m.tags || !m.tags.length) return false;
        return ftLower.some(function(ft) { return m.tags.indexOf(ft) !== -1; });
      });
    }
    if (!query || !query.trim()) return candidateMemories.slice(0, maxResults);
    var ql = query.toLowerCase();
    var scored = candidateMemories.map(function(m) {
      var score = 0;
      var memText = ((m.content || m.text || m.summary || '') + ' ' + (m.title || '')).toLowerCase();
      if (memText.indexOf(ql) !== -1) score += 10;
      else {
        var words = ql.split(/\s+/);
        for (var wi = 0; wi < words.length; wi++) {
          if (words[wi] && memText.indexOf(words[wi]) !== -1) score += 3;
        }
      }
      if (m.emotional) score += 2;
      return { mem: m, score: score };
    });
    scored.sort(function(a, b) { return b.score - a.score; });
    return scored.filter(function(s) { return s.score > 0; }).slice(0, maxResults).map(function(s) { return s.mem; });
  }

  function isHotMemory(memory, currentRound, config) {
    config = config || {};
    var rounds = config.hotMemoryRounds || 50;
    var importanceMin = config.hotMemoryImportance || 2;
    if (memory.lastAccessRound && (currentRound - memory.lastAccessRound) <= rounds) return true;
    if (memory.importance >= importanceMin) return true;
    return false;
  }

  function getMemoryStats(state) {
    if (!state || !state.memories) return { total: 0, hot: 0, cold: 0 };
    var config = state.settings || state.config || {};
    var hot = 0, cold = 0;
    for (var mi = 0; mi < state.memories.length; mi++) {
      state.memories[mi].lastAccessRound = state.memories[mi].lastAccessRound || 0;
      if (isHotMemory(state.memories[mi], state.round, config)) hot++;
      else cold++;
    }
    return { total: state.memories.length, hot: hot, cold: cold };
  }

  function cleanupState(state) {
    if (!state.memories) return;
    var now = state.round;
    var before = state.memories.length;
    state.memories = state.memories.filter(function(m) {
      if (m.importance >= 3) return true;
      if (m.importance === 2) return now - m.round < 50;
      if (m.importance === 1) return now - m.round < 30;
      return true;
    });
    var after = state.memories.length;
    if (before !== after) {
      saveState(state);
      console.log('[World Engine] 清理记忆：' + before + ' → ' + after + ' (移除了 ' + (before - after) + ' 条)');
    }
  }

  // ========== 世界时间 ==========

  // 十二时辰系统（每时辰 = 60 世界分钟，一天 = 720 分钟）
  var SHICHEN = [
    { name: '子时', branch: '子', animal: '鼠', start: 0,   end: 60,  modern: '00:00-01:00' },
    { name: '丑时', branch: '丑', animal: '牛', start: 60,  end: 120, modern: '01:00-03:00' },
    { name: '寅时', branch: '寅', animal: '虎', start: 120, end: 180, modern: '03:00-05:00' },
    { name: '卯时', branch: '卯', animal: '兔', start: 180, end: 240, modern: '05:00-07:00' },
    { name: '辰时', branch: '辰', animal: '龙', start: 240, end: 300, modern: '07:00-09:00' },
    { name: '巳时', branch: '巳', animal: '蛇', start: 300, end: 360, modern: '09:00-11:00' },
    { name: '午时', branch: '午', animal: '马', start: 360, end: 420, modern: '11:00-13:00' },
    { name: '未时', branch: '未', animal: '羊', start: 420, end: 480, modern: '13:00-15:00' },
    { name: '申时', branch: '申', animal: '猴', start: 480, end: 540, modern: '15:00-17:00' },
    { name: '酉时', branch: '酉', animal: '鸡', start: 540, end: 600, modern: '17:00-19:00' },
    { name: '戌时', branch: '戌', animal: '狗', start: 600, end: 660, modern: '19:00-21:00' },
    { name: '亥时', branch: '亥', animal: '猪', start: 660, end: 720, modern: '21:00-23:00' }
  ];
  var DAY_NAMES = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
    '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
    '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];

  /**
   * 将世界分钟数转换为时辰信息
   * @param {number} totalMinutes - 总世界分钟数（inWorldMinutes + worldTimeEpoch）
   * @returns {object} { day, dayName, shichen, animal, modern, hourInDay }
   */
  function getWorldTimeInfo(totalMinutes) {
    var mins = Math.max(0, Math.floor(totalMinutes || 0));
    var day = Math.floor(mins / 720);  // 0-based day index
    var minInDay = mins % 720;
    var shichen = SHICHEN[0];
    for (var i = 0; i < SHICHEN.length; i++) {
      if (minInDay >= SHICHEN[i].start && minInDay < SHICHEN[i].end) { shichen = SHICHEN[i]; break; }
    }
    var dayName = DAY_NAMES[day % 30] || ('第' + (day + 1) + '天');
    return {
      day: day,
      dayName: dayName,
      shichen: shichen.name,
      branch: shichen.branch,
      animal: shichen.animal,
      modern: shichen.modern,
      minInDay: minInDay,
      hourInDay: Math.floor(minInDay / 60 * 2) // 0-23 approximate
    };
  }

  /**
   * 获取当前世界时间的显示字符串
   */
  function getWorldTimeDisplay(state) {
    var total = (state.worldTimeEpoch || 0) + (state.inWorldMinutes || 0);
    var info = getWorldTimeInfo(total);
    var label = state.worldTimeLabel ? state.worldTimeLabel + ' ' : '';
    return label + info.dayName + ' ' + info.shichen + '（' + info.modern + '）';
  }

  /**
   * 设置世界时间起点
   * @param {object} state
   * @param {number} epochMinutes - 起点分钟数（如“初三巳时”= 2*720+300 = 1740）
   * @param {string} label - 时间标签（如“天宝三载”）
   */
  function setWorldTimeEpoch(state, epochMinutes, label) {
    state.worldTimeEpoch = Math.max(0, epochMinutes || 0);
    state.worldTimeLabel = label || '';
    saveState(state);
    return getWorldTimeDisplay(state);
  }

  /**
   * 根据时辰名称查找对应的分钟偏移（在一天内）
   */
  function getShichenMinutes(shichenName) {
    for (var i = 0; i < SHICHEN.length; i++) {
      if (SHICHEN[i].name === shichenName || SHICHEN[i].branch === shichenName) return SHICHEN[i].start;
    }
    return 0;
  }

  // ========== 世界切换（穿越/转场）==========

  /**
   * 应用世界切换，支持穿越到不同世界观
   * @param {object} state
   * @param {object} config - { preset, framework, frameworkName, dimensions, customRules, timeEpoch, timeLabel, storyTemplate, tone, reason }
   */
  function applyWorldTransition(state, config) {
    if (!state || !config) return false;
    config = config || {};
    var prevWorld = {
      framework: state.worldLaws ? state.worldLaws.frameworkName : '未知',
      timeLabel: state.worldTimeLabel || '',
      template: state.storyType ? state.storyType.template : null
    };

    // 1. 切换世界法则
    if (config.preset) {
      applyWorldLawPreset(state, config.preset);
    } else {
      state.worldLaws = state.worldLaws || {};
      if (config.framework) state.worldLaws.framework = config.framework;
      if (config.frameworkName) state.worldLaws.frameworkName = config.frameworkName;
      if (config.dimensions) {
        var dims = state.worldLaws.dimensions || {};
        Object.keys(config.dimensions).forEach(function(k) {
          if (dims[k]) dims[k].value = config.dimensions[k];
          else dims[k] = { label: k, value: config.dimensions[k], options: [] };
        });
        state.worldLaws.dimensions = dims;
      }
      if (config.customRules !== undefined) {
        state.worldLaws.customRules = Array.isArray(config.customRules) ? config.customRules : [];
      }
      state.worldLaws.derivedConstraints = [];
      state.worldLaws.lastModifiedRound = state.round;
    }

    // 2. 切换时间系统（重置时间起点）
    if (config.timeEpoch !== undefined) {
      state.worldTimeEpoch = Math.max(0, config.timeEpoch || 0);
      state.inWorldMinutes = 0;  // 新世界从 0 开始计时
      state.timeLogs = [];        // 清空旧世界时间日志
    }
    if (config.timeLabel !== undefined) {
      state.worldTimeLabel = config.timeLabel || '';
    }

    // 3. 切换故事模板
    if (config.storyTemplate !== undefined) {
      state.storyType = state.storyType || {};
      state.storyType.template = config.storyTemplate || null;
      state.storyType.currentPhase = 0;
      state.storyType.phaseProgress = 0;
    }
    if (config.tone) {
      state.storyType = state.storyType || {};
      state.storyType.tone = config.tone;
    }

    // 4. 记录穿越日志
    if (!state.worldTransitionLog) state.worldTransitionLog = [];
    state.worldTransitionLog.push({
      round: state.round,
      from: prevWorld,
      to: {
        framework: state.worldLaws ? state.worldLaws.frameworkName : '未知',
        timeLabel: state.worldTimeLabel || '',
        template: state.storyType ? state.storyType.template : null
      },
      reason: config.reason || '',
      timestamp: Date.now()
    });
    if (state.worldTransitionLog.length > 20) state.worldTransitionLog = state.worldTransitionLog.slice(-20);

    saveState(state);
    console.log('[World Engine] 🌀 世界切换: ' + prevWorld.framework + ' → ' + (state.worldLaws ? state.worldLaws.frameworkName : '未知'));
    return true;
  }

  function addTimeLog(state, minutes, source) {
    if (!state.timeLogs) state.timeLogs = [];
    var total = (state.inWorldMinutes || 0) + minutes;
    var worldTotal = (state.worldTimeEpoch || 0) + total;
    var info = getWorldTimeInfo(worldTotal);
    state.timeLogs.unshift({
      round: state.round,
      minutes: minutes,
      source: source || 'manual',
      total: total,
      worldTotal: worldTotal,
      worldTime: info.dayName + ' ' + info.shichen,
      timestamp: Date.now()
    });
    if (state.timeLogs.length > 50) state.timeLogs.pop();
    state.inWorldMinutes = total;
    saveState(state);
    return total;
  }

  function getTimeLogs(state, limit) {
    if (!state.timeLogs) return [];
    return state.timeLogs.slice(0, limit || 20);
  }

  // ========== NPC 日程系统 ==========

  function updateNpcSchedule(state, npcName, updates) {
    if (!state.npcSchedules) state.npcSchedules = {};
    if (!state.npcSchedules[npcName]) {
      state.npcSchedules[npcName] = {
        occupation: '未知', routines: [], lastKnownLocation: '未知',
        lastKnownActivity: '未知', lastUpdatedRound: state.round, personality: ''
      };
    }
    var s = state.npcSchedules[npcName];
    if (updates.occupation !== undefined) s.occupation = updates.occupation;
    if (updates.routines !== undefined) s.routines = updates.routines;
    if (updates.lastKnownLocation !== undefined) s.lastKnownLocation = updates.lastKnownLocation;
    if (updates.lastKnownActivity !== undefined) s.lastKnownActivity = updates.lastKnownActivity;
    if (updates.personality !== undefined) s.personality = updates.personality;
    s.lastUpdatedRound = state.round;
    saveState(state);
  }

  function getNpcCurrentActivity(state, npcName, inWorldMinutes) {
    if (!state.npcSchedules || !state.npcSchedules[npcName]) return null;
    var npc = state.npcSchedules[npcName];
    if (!npc.routines || npc.routines.length === 0) {
      return { activity: npc.lastKnownActivity || '未知', location: npc.lastKnownLocation || '未知' };
    }
    var hour = Math.floor((inWorldMinutes || 0) / 60) % 24;
    var timeOfDay = 'night';
    if (hour >= 4 && hour < 7) timeOfDay = 'dawn';
    else if (hour >= 7 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 14) timeOfDay = 'noon';
    else if (hour >= 14 && hour < 18) timeOfDay = 'afternoon';
    else if (hour >= 18 && hour < 21) timeOfDay = 'evening';
    var routine = npc.routines.find(function(r) { return r.timeOfDay === timeOfDay; });
    if (routine) return { activity: routine.activity, location: routine.location };
    return { activity: npc.lastKnownActivity || '在忙', location: npc.lastKnownLocation || '未知' };
  }

  function getActiveNpcs(state, minRound) {
    if (!state.npcActivityLog) return [];
    var cutoff = minRound !== undefined ? state.round - minRound : 20;
    var names = {};
    for (var i = 0; i < state.npcActivityLog.length; i++) {
      var a = state.npcActivityLog[i];
      if (a.round >= state.round - cutoff) { names[a.npc] = (names[a.npc] || 0) + 1; }
      else break;
    }
    if (state.emotionMap) {
      for (var n in state.emotionMap) { if (!names[n]) names[n] = 0; }
    }
    return Object.keys(names).sort(function(a, b) { return names[b] - names[a]; });
  }

  // ========== 角色画像扩展（基于 NPC 对象） ==========

  function updatePersonalityTag(state, npcName, tag, evidence) {
    if (!npcName || !tag) return;
    var npc = (state.npcs || []).find(function(n) { return n.name === npcName; });
    if (!npc) return;
    if (!npc.personalityTags) npc.personalityTags = [];
    var idx = -1;
    for (var i = 0; i < npc.personalityTags.length; i++) {
      if (npc.personalityTags[i].tag === tag) { idx = i; break; }
    }
    if (idx !== -1) {
      npc.personalityTags[idx].evidence = evidence || npc.personalityTags[idx].evidence;
      npc.personalityTags[idx].round = state.round;
    } else {
      if (npc.personalityTags.length >= 10) npc.personalityTags.shift();
      npc.personalityTags.push({ tag: tag, source: 'evolve', round: state.round, evidence: evidence || '' });
    }
    saveState(state);
  }

  function addKeyEventToPortrait(state, npcName, eventDesc, type, roundNum) {
    if (!npcName || !eventDesc) return;
    var npc = (state.npcs || []).find(function(n) { return n.name === npcName; });
    if (!npc) return;
    if (!npc.keyEvents) npc.keyEvents = [];
    npc.keyEvents.push({ round: roundNum !== undefined ? roundNum : state.round, event: eventDesc, type: type || 'general' });
    if (npc.keyEvents.length > 15) npc.keyEvents = npc.keyEvents.slice(npc.keyEvents.length - 15);
    saveState(state);
  }

  function updatePortraitStats(state, npcName, statUpdates) {
    if (!npcName || !statUpdates) return;
    var npc = (state.npcs || []).find(function(n) { return n.name === npcName; });
    if (!npc) return;
    if (!npc.stats) npc.stats = { kills: 0, injuries: 0, travels: [], goldEarned: 0, questsCompleted: 0, conversationsWithPlayer: 0 };
    if (statUpdates.kills !== undefined) npc.stats.kills += statUpdates.kills;
    if (statUpdates.injuries !== undefined) npc.stats.injuries += statUpdates.injuries;
    if (statUpdates.goldEarned !== undefined) npc.stats.goldEarned += statUpdates.goldEarned;
    if (statUpdates.questsCompleted !== undefined) npc.stats.questsCompleted += statUpdates.questsCompleted;
    if (statUpdates.conversationsWithPlayer !== undefined) npc.stats.conversationsWithPlayer += statUpdates.conversationsWithPlayer;
    if (statUpdates.travels && Array.isArray(statUpdates.travels)) {
      for (var si = 0; si < statUpdates.travels.length; si++) {
        if (npc.stats.travels.indexOf(statUpdates.travels[si]) === -1) npc.stats.travels.push(statUpdates.travels[si]);
      }
    }
    saveState(state);
  }

  function getPortraitSummary(state, npcName) {
    var npc = (state.npcs || []).find(function(n) { return n.name === npcName; });
    if (!npc) return '';
    if (npc.digest) return npc.digest.length > 100 ? npc.digest.substring(0, 100) + '…' : npc.digest;
    var parts = [];
    parts.push(npc.name + '：' + (npc.race || '未知') + '·' + (npc.gender || '未知') + '·' + (npc.age || '?') + '岁·' + (npc.ageStage || '成年'));
    if (npc.occupation && npc.occupation !== '未知') parts.push('职业：' + npc.occupation);
    if (npc.personalityTags && npc.personalityTags.length > 0) {
      parts.push('性格：' + npc.personalityTags.slice(0, 4).map(function(t) { return t.tag; }).join('、'));
    }
    if (npc.combatStyle && npc.combatStyle.style && npc.combatStyle.style !== '未分类') {
      parts.push('战力：' + npc.combatStyle.style + '(' + (npc.combatStyle.rating || 0) + ')');
    }
    if (npc.stats && npc.stats.kills > 0) parts.push('击杀：' + npc.stats.kills);
    var summary = parts.join(' | ');
    return summary.length > 100 ? summary.substring(0, 100) + '…' : summary;
  }

  // ========== 全局剧情线索板 ==========

  function generateThreadId() {
    return 'pt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  }

  function addGlobalPlotThread(state, thread) {
    if (!state.globalPlotThreads) state.globalPlotThreads = [];
    var idx = state.globalPlotThreads.findIndex(function(t) { return t.id === thread.id; });
    if (idx !== -1) {
      state.globalPlotThreads[idx] = Object.assign({}, state.globalPlotThreads[idx], thread);
      state.globalPlotThreads[idx].lastUpdatedRound = state.round;
    } else {
      thread.lastUpdatedRound = state.round;
      thread.progress = thread.progress || 0;
      thread.status = thread.status || 'active';
      if (!thread.milestones) thread.milestones = [];
      if (!thread.connectedEventNames) thread.connectedEventNames = [];
      if (!thread.connectedThreadIds) thread.connectedThreadIds = [];
      if (!thread.participants) thread.participants = [];
      if (!thread.relatedFactions) thread.relatedFactions = [];
      state.globalPlotThreads.unshift(thread);
    }
    if (state.globalPlotThreads.length > 30) state.globalPlotThreads.pop();
    saveState(state);
    logEvent(state, 'thread_created', thread.id, { title: thread.title, type: thread.type });
  }

  function updatePlotThreadProgress(state, threadId, progress, phase, roundNum) {
    if (!state.globalPlotThreads) return;
    var thread = state.globalPlotThreads.find(function(t) { return t.id === threadId; });
    if (!thread) return;
    roundNum = roundNum || state.round;
    thread.progress = Math.min(100, Math.max(0, progress));
    if (phase !== undefined) thread.phase = phase;
    thread.lastUpdatedRound = roundNum;
    if (thread.progress >= 100 && thread.status === 'active') {
      thread.status = 'completed';
      if (!thread.milestones) thread.milestones = [];
      thread.milestones.push({ round: roundNum, event: '🔚 线索完结' });
    }
    saveState(state);
  }

  function completePlotThread(state, threadId, status) {
    if (!state.globalPlotThreads) return;
    var thread = state.globalPlotThreads.find(function(t) { return t.id === threadId; });
    if (!thread) return;
    thread.status = status || 'completed';
    thread.progress = status === 'completed' ? 100 : thread.progress;
    thread.lastUpdatedRound = state.round;
    if (!thread.milestones) thread.milestones = [];
    thread.milestones.push({ round: state.round, event: status === 'completed' ? '🏁 线索完结' : '💀 线索失败' });
    saveState(state);
  }

  function getActivePlotThreads(state) {
    if (!state.globalPlotThreads) return [];
    return state.globalPlotThreads.filter(function(t) { return t.status === 'active' || t.status === 'frozen'; });
  }

  function addThreadMilestone(state, threadId, eventDesc) {
    if (!state.globalPlotThreads) return;
    var thread = state.globalPlotThreads.find(function(t) { return t.id === threadId; });
    if (!thread) return;
    if (!thread.milestones) thread.milestones = [];
    thread.milestones.push({ round: state.round, event: eventDesc });
    thread.lastUpdatedRound = state.round;
    if (thread.milestones.length > 30) thread.milestones.splice(0, thread.milestones.length - 30);
    saveState(state);
  }

  // ========== 角色生命周期 ==========

  function initCharacterLifecycle(state, charName) {
    if (!state) return;
    if (!state.characterLifecycles) state.characterLifecycles = {};
    if (!state.characterLifecycles[charName]) {
      state.characterLifecycles[charName] = {
        state: 'ALIVE', birthRound: state.round || 0, deathRound: null,
        rebirthCount: 0, lastStateChange: state.round || 0, totalLifecycles: 0
      };
    }
    return state.characterLifecycles[charName];
  }

  function applyLifecycleTransition(state, charName, targetState) {
    if (!state || !charName || !targetState) return false;
    if (!state.characterLifecycles) state.characterLifecycles = {};
    var lc = state.characterLifecycles[charName];
    if (!lc) lc = initCharacterLifecycle(state, charName);
    var prev = lc.state;
    lc.prevState = prev;
    lc.state = targetState;
    lc.lastStateChange = state.round || 0;
    if (targetState === 'DEAD') { lc.deathRound = state.round || 0; lc.totalLifecycles++; }
    if (targetState === 'REBORN') {
      lc.rebirthCount = (lc.rebirthCount || 0) + 1;
      lc.totalLifecycles = (lc.totalLifecycles || 0) + 1;
      lc.birthRound = state.round || 0;
    }
    logEvent(state, 'lifecycle', charName, { from: prev, to: targetState });
    return true;
  }

  function getCharacterLifecycle(state, charName) {
    if (!state || !state.characterLifecycles) return null;
    return state.characterLifecycles[charName] || null;
  }

  function setCharacterLifecycle(state, charName, newState) {
    if (!state.characterLifecycles) state.characterLifecycles = {};
    if (!LIFECYCLE_STATES[newState]) return false;
    if (!state.characterLifecycles[charName]) {
      state.characterLifecycles[charName] = { state: 'ALIVE', lastChangedRound: 0, history: [] };
    }
    var prev = state.characterLifecycles[charName].state;
    state.characterLifecycles[charName].state = newState;
    state.characterLifecycles[charName].lastChangedRound = state.round;
    if (!state.characterLifecycles[charName].history) state.characterLifecycles[charName].history = [];
    state.characterLifecycles[charName].history.push({ from: prev, to: newState, round: state.round });
    saveState(state);
    return true;
  }

  function getAllLifecycleSummary(state) {
    if (!state || !state.characterLifecycles) return {};
    return state.characterLifecycles;
  }

  function getLifecycleStats(state) {
    if (!state || !state.characterLifecycles) return { total: 0, alive: 0, dead: 0, reborn: 0, dormant: 0 };
    var stats = { total: 0, alive: 0, dead: 0, reborn: 0, dormant: 0 };
    for (var name in state.characterLifecycles) {
      stats.total++;
      var s = state.characterLifecycles[name].state;
      if (s === 'DEAD') stats.dead++;
      else if (s === 'REBORN') stats.reborn++;
      else if (s === 'DORMANT') stats.dormant++;
      else stats.alive++;
    }
    return stats;
  }

  // ========== 事件日志与导出工具 ==========

  function logEvent(state, type, sourceId, data) {
    if (!state.eventLog) state.eventLog = [];
    state.eventLog.push({
      type: type, sourceId: sourceId, round: state.round || 0,
      timestamp: Date.now(), data: data || {}
    });
    if (state.eventLog.length > 200) state.eventLog = state.eventLog.slice(-200);
  }

  function exportSnapshot() {
    var state = loadState();
    if (!state) return null;
    var snapshot = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      state: state
    };
    var jsonStr = JSON.stringify(snapshot, null, 2);
    var blob = new Blob([jsonStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'world-engine-backup-' + (state.round || 0) + '-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    return jsonStr;
  }

  function importSnapshot(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var data = JSON.parse(e.target.result);
          if (!data.state) { reject(new Error('无效的快照文件')); return; }
          importState(data.state);
          resolve({ round: data.state.round || 0 });
        } catch(err) { reject(new Error('快照解析失败: ' + err.message)); }
      };
      reader.onerror = function() { reject(new Error('文件读取失败')); };
      reader.readAsText(file);
    });
  }

  function autoBackup(state) {
    if (!state || !state.round) return;
    if (state.round % 50 !== 0) return;
    if (!state._autoBackups) state._autoBackups = [];
    var entry = { round: state.round, timestamp: Date.now(), state: JSON.parse(JSON.stringify(state)) };
    state._autoBackups.push(entry);
    if (state._autoBackups.length > 3) state._autoBackups = state._autoBackups.slice(-3);
  }

  function generateLegend(state, characterName) {
    if (!state || !characterName) return '';
    var round = state.round || 0;
    var combat = state.combat || {};
    var lines = [];
    lines.push(characterName + '的传奇');
    lines.push('历经' + round + '轮风云变幻');
    if (state.achievements && state.achievements.unlocked) {
      var unlocked = Object.keys(state.achievements.unlocked);
      if (unlocked.length > 0) lines.push('达成成就: ' + unlocked.slice(0, 5).join('、'));
    }
    if ((combat.totalBattles || 0) > 0) lines.push('经历战斗: ' + combat.totalBattles + ' 场');
    if ((combat.wins || 0) > 0) lines.push('胜利次数: ' + combat.wins);
    return lines.join(' · ');
  }

  // ========== 导出/导入清理 ==========

  /** 清理后的导出数据（去掉调试/内部字段） */
  function getCleanExport(state) {
    const s = JSON.parse(JSON.stringify(state));

    // 去掉调试/内部字段
    delete s.lastEvolveResult;
    delete s.lastInjection;
    delete s.lastUpdated;
    delete s._terminalEventsThisRound;

    // 修复事件 stageRound>=9
    if (s.events) {
      for (const ev of s.events) {
        ensureEventFields(ev);
      }
    }

    return ensureArrays(s);
  }

  /** 导入时合并到当前状态 */
  function importState(importedState) {
    const clean = JSON.parse(JSON.stringify(importedState));
    // 去掉导入数据里的内部字段
    delete clean.lastEvolveResult;
    delete clean.lastInjection;
    delete clean.lastUpdated;
    delete clean._terminalEventsThisRound;
    // 修复事件
    if (clean.events) {
      for (const ev of clean.events) ensureEventFields(ev);
    }
    // 确保必要字段
    clean.memories = clean.memories || [];
    clean.lastEvolveResult = null;
    clean.lastInjection = null;
    clean.chatLayer = getChatLayer();
    const chatId = getChatId();
    clean.lastUpdated = { chatId, timestamp: Date.now() };
    ensureArrays(clean);
    saveState(clean);
    return clean;
  }

  return {
    // 基础
    getDefaultState, getChatId, loadState, hasState, saveState, clearState, saveStateWithLayer,
    addMemory, addEvent, addFaction, addWorldTrend, addWind,
    addNpc, addNpcActivity, addNpcPlotThread, updateNpcLifecycle,
    ensureEventFields, getUserName, renderUserName,
    saveCheckpoint, restoreCheckpoint, clearCheckpoint, getAnchorLayer, setAnchorLayer,
    getChatLayer, getChatFingerprint, saveFingerprint, loadFingerprint, isNewRound,
    getCleanExport, importState,
    cnToNum, parseStoryDay, getLastStoryDay, setLastStoryDay, filterDialogue,
    // ★ 常量
    EMOTION_STATES, EMOTION_TRANSITIONS, LIFECYCLE_STATES, COMBO_BADGES,
    WORLD_LAW_DIMENSIONS, WORLD_LAW_PRESETS, EMOTIONAL_TONES, STORY_TEMPLATES, ACHIEVEMENT_DEFS,
    // ★ 成就系统
    unlockAchievement, checkAutoAchievements, checkAutoUnlockAchievements,
    checkCombatAchievements, checkHiddenAchievements,
    getAchievementProgress, getAchievementRarity, getComboBadge,
    addAchievementEcho, getAchievementEchoes,
    // ★ 情感状态机
    applyEmotionState, decayEmotionStates, getEmotionStateSummary, getEmotionSummary,
    // ★ 故事方向
    getStoryPromptBlock, advanceStoryPhase, getTemplateById, getToneDisplayName,
    // ★ 世界法则
    applyWorldLawPreset, getWorldLawConstraintsArray, setWorldLawDimension,
    addWorldLawCustomRule, removeWorldLawCustomRule, setWorldLawDerivedConstraints,
    // ★ 战斗系统
    addCombatLog, getCombatStats, getCombatLog, getCombatSummary, updateStreak, registerBossDefeat,
    // ★ 记忆冷热
    extractTags, searchMemory, isHotMemory, getMemoryStats, cleanupState,
    // ★ 世界时间
    addTimeLog, getTimeLogs, getWorldTimeInfo, getWorldTimeDisplay, setWorldTimeEpoch, getShichenMinutes,
    SHICHEN, DAY_NAMES,
    // ★ 世界切换
    applyWorldTransition,
    // ★ NPC 日程
    updateNpcSchedule, getNpcCurrentActivity, getActiveNpcs,
    // ★ 角色画像扩展
    updatePersonalityTag, addKeyEventToPortrait, updatePortraitStats, getPortraitSummary,
    // ★ 全局剧情线索板
    generateThreadId, addGlobalPlotThread, updatePlotThreadProgress,
    completePlotThread, getActivePlotThreads, addThreadMilestone,
    // ★ 角色生命周期
    initCharacterLifecycle, applyLifecycleTransition, getCharacterLifecycle,
    setCharacterLifecycle, getAllLifecycleSummary, getLifecycleStats,
    // ★ 导出工具
    logEvent, exportSnapshot, importSnapshot, autoBackup, generateLegend
  };
})();
