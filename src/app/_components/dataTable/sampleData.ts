type NonEmptyArray<T> = readonly [T, ...T[]];

export const SAMPLE_NAMES: NonEmptyArray<string> = [
	"Ava",
	"Ethan",
	"Isabella",
	"Mia",
	"Liam",
	"Noah",
	"Olivia",
	"Ruby",
	"Jack",
	"William",
];

export const SAMPLE_DOMAINS: NonEmptyArray<string> = [
	"yahoo.com",
	"gmail.com",
	"icloud.com",
	"outlook.com",
];

export const SAMPLE_WORDS: NonEmptyArray<string> = [
	"consectetur",
	"adipiscing",
	"elit",
	"dolor",
	"amet",
	"lorem",
	"ipsum",
];

export const SAMPLE_COMPANIES: NonEmptyArray<string> = [
	"Acme Corp",
	"Globex",
	"Innotech",
	"Umbrella",
	"Wayne Enterprises",
];

export const SAMPLE_CITIES: NonEmptyArray<string> = [
	"Sydney",
	"Melbourne",
	"Perth",
	"Auckland",
	"Toronto",
];
