import { faker } from "@faker-js/faker";

export interface Contact {
	id: string;
	fullName: string;
	username: string;
	profilePhoto: string;
	emailAddress: string;
	phoneNumber: string;
	receivedPings: string;
	sentPings: string;
	lastPingSentAt: string;
	lastPingReceivedAt: string;
}

export function generateFakeContacts(count = 10): Contact[] {
	return Array.from({ length: count }, () => ({
		id: faker.string.uuid(),
		fullName: faker.person.fullName(),
		username: faker.internet.username(),
		profilePhoto: faker.image.avatar(),
		emailAddress: faker.internet.email(),
		phoneNumber: faker.phone.number(),
		receivedPings: faker.lorem.words(3),
		sentPings: faker.lorem.words(3),
		lastPingSentAt: faker.date.recent().toLocaleDateString(),
		lastPingReceivedAt: faker.date.recent().toLocaleDateString(),
	}));
}
