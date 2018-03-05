/*
*
*  Copyright 2016 Yann Massard (https://github.com/yamass) and other contributors
*
*  Licensed under the Apache License, Version 2.0 (the "License");
*  you may not use this file except in compliance with the License.
*  You may obtain a copy of the License at
*
*  http://www.apache.org/licenses/LICENSE-2.0
*
*  Unless required by applicable law or agreed to in writing, software
*  distributed under the License is distributed on an "AS IS" BASIS,
*  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*  See the License for the specific language governing permissions and
*  limitations under the License.
*
*/

export interface TimeSuggestion {
	hour: number;
	minute: number;
}
export interface TimeComboBoxEntry {
	hour: number,
	minute: number,
	hourString: string,
	minuteString: string,
	displayString: string,
	hourAngle: number,
	minuteAngle: number,
	isNight: boolean
}

export class TrivialTimeSuggestionEngine {

	constructor() {
	}

	public generateSuggestions(searchString: string): TimeSuggestion[] {
		let suggestions: TimeSuggestion[] = [];

		const match = searchString.match(/[^\d]/);
		const colonIndex = match != null ? match.index : null;
		if (colonIndex !== null) {
			const hourString = searchString.substring(0, colonIndex);
			const minuteString = searchString.substring(colonIndex + 1);
			suggestions = suggestions.concat(TrivialTimeSuggestionEngine.createTimeSuggestions(TrivialTimeSuggestionEngine.createHourSuggestions(hourString), TrivialTimeSuggestionEngine.createMinuteSuggestions(minuteString)));
		} else if (searchString.length > 0) { // is a number!
			if (searchString.length >= 2) {
				const hourString = searchString.substr(0, 2);
				const minuteString = searchString.substring(2, searchString.length);
				suggestions = suggestions.concat(TrivialTimeSuggestionEngine.createTimeSuggestions(TrivialTimeSuggestionEngine.createHourSuggestions(hourString), TrivialTimeSuggestionEngine.createMinuteSuggestions(minuteString)));
			}
			const hourString = searchString.substr(0, 1);
			const minuteString = searchString.substring(1, searchString.length);
			if (minuteString.length <= 2) {
				suggestions = suggestions.concat(TrivialTimeSuggestionEngine.createTimeSuggestions(TrivialTimeSuggestionEngine.createHourSuggestions(hourString), TrivialTimeSuggestionEngine.createMinuteSuggestions(minuteString)));
			}
		} else {
			suggestions = suggestions.concat(TrivialTimeSuggestionEngine.createTimeSuggestions(TrivialTimeSuggestionEngine.intRange(6, 24).concat(TrivialTimeSuggestionEngine.intRange(1, 5)), [0]));
		}
		return suggestions;
	}

	private static intRange(fromInclusive: number, toInclusive: number) {
		const ints = [];
		for (let i = fromInclusive; i <= toInclusive; i++) {
			ints.push(i)
		}
		return ints;
	}

	private static createTimeSuggestions(hourValues: number[], minuteValues: number[]): TimeSuggestion[] {
		const entries: TimeSuggestion[] = [];
		for (let i = 0; i < hourValues.length; i++) {
			const hour = hourValues[i];
			for (let j = 0; j < minuteValues.length; j++) {
				const minute = minuteValues[j];
				entries.push({hour, minute});
			}
		}
		return entries;
	}

	private static createMinuteSuggestions(minuteString: string): number[] {
		const m = parseInt(minuteString);
		if (isNaN(m)) {
			return [0];
		} else if (minuteString.length > 1) {
			return [m % 60]; // the user entered an exact minute string!
		} else if (m < 6) {
			return [m * 10];
		} else {
			return [m % 60];
		}
	}

	private static createHourSuggestions(hourString: string): number[] {
		const h = parseInt(hourString);
		if (isNaN(h)) {
			return TrivialTimeSuggestionEngine.intRange(1, 24);
			//} else if (h < 10) {
			//    return [(h + 12) % 24, h]; // afternoon first
			//} else if (h >= 10 && h < 12) {
			//    return [h, (h + 12) % 24]; // morning first
		} else if (h < 12) {
			return [h, (h + 12) % 24]; // morning first

		} else if (h <= 24) {
			return [h % 24];
		} else {
			return [];
		}
	}
}