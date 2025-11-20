import { faker } from "@faker-js/faker";

export type Column = {
	id: string;
	type: string;
	name: string;
};

/**
 * Generates faker.js data based on column type and name
 */
export function generateCellValue(column: Column): string | number {
	if (column.type === "NUMBER") {
		if (column.name.toLowerCase().includes("age")) {
			return faker.number.int({ min: 18, max: 98 });
		}
		if (column.name.toLowerCase().includes("year")) {
			return faker.number.int({ min: 1990, max: new Date().getFullYear() });
		}
		if (column.name.toLowerCase().includes("price") || column.name.toLowerCase().includes("cost")) {
			return faker.number.int({ min: 1, max: 10000 });
		}
		if (column.name.toLowerCase().includes("quantity") || column.name.toLowerCase().includes("count")) {
			return faker.number.int({ min: 1, max: 100 });
		}
		// Generic number
		return faker.number.int({ min: 1, max: 1000 });
	}

	// TEXT type
	const columnNameLower = column.name.toLowerCase();
	
	if (columnNameLower.includes("name")) {
		if (columnNameLower.includes("first")) {
			return faker.person.firstName();
		}
		if (columnNameLower.includes("last")) {
			return faker.person.lastName();
		}
		if (columnNameLower.includes("company") || columnNameLower.includes("business")) {
			return faker.company.name();
		}
		// Generic full name
		return faker.person.fullName();
	}
	
	if (columnNameLower.includes("email")) {
		return faker.internet.email({
			firstName: faker.person.firstName(),
			lastName: faker.person.lastName(),
		});
	}
	
	if (columnNameLower.includes("phone")) {
		return faker.phone.number();
	}
	
	if (columnNameLower.includes("address")) {
		return faker.location.streetAddress();
	}
	
	if (columnNameLower.includes("city")) {
		return faker.location.city();
	}
	
	if (columnNameLower.includes("state")) {
		return faker.location.state();
	}
	
	if (columnNameLower.includes("country")) {
		return faker.location.country();
	}
	
	if (columnNameLower.includes("title") || columnNameLower.includes("position")) {
		return faker.person.jobTitle();
	}
	
	if (columnNameLower.includes("department")) {
		return faker.person.jobArea();
	}
	
	if (columnNameLower.includes("description") || columnNameLower.includes("note")) {
		return faker.lorem.sentence();
	}
	
	if (columnNameLower.includes("url") || columnNameLower.includes("website")) {
		return faker.internet.url();
	}
	
	if (columnNameLower.includes("color")) {
		return faker.color.human();
	}
	
	// Generic text
	return faker.lorem.word();
}

/**
 * Generates sample rows for a new table
 */
export function generateSampleRows(
	columns: Column[], 
	tableId: string, 
	rowCount: number = 5
) {
	return Array.from({ length: rowCount }, (_, index) => ({
		tableId,
		position: index,
		cells: {
			create: columns.map((column) => ({
				columnId: column.id,
				value: String(generateCellValue(column)),
			})),
		},
	}));
}