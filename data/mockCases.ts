import { Case } from '../lib/types';

export const MOCK_CASES: Case[] = [
  {
    id: '1',
    name: 'Canada (Minister of Citizenship and Immigration) v. Vavilov',
    citation: '2019 SCC 65',
    year: 2019,
    court: 'SCC',
    tags: ['Standard of Review', 'Reasonableness', 'Vavilov'],
    summary: 'The landmark decision establishing the presumption of reasonableness review for administrative decisions.',
    paragraphs: [
      { id: '1-85', number: 85, text: 'A reasonable decision is one that is based on an internally coherent and rational chain of analysis and that is justified in relation to the facts and law that constrain the decision maker.' },
      { id: '1-86', number: 86, text: 'The reviewing court must consider whether the decision bears the hallmarks of reasonableness — justification, transparency and intelligibility.' },
      { id: '1-100', number: 100, text: 'The burden is on the party challenging the decision to show that it is unreasonable.' }
    ]
  },
  {
    id: '2',
    name: 'Kanthasamy v. Canada (Citizenship and Immigration)',
    citation: '2015 SCC 61',
    year: 2015,
    court: 'SCC',
    tags: ['H&C', 'Best Interests of the Child', 'Hardship'],
    summary: 'Clarified the scope of humanitarian and compassionate considerations under s. 25(1) of IRPA.',
    paragraphs: [
      { id: '2-25', number: 25, text: 'The words "unusual and undeserved or disproportionate hardship" should be treated as descriptive, not as creating three new thresholds for relief.' },
      { id: '2-33', number: 33, text: 'The "best interests of the child" principle must be applied in a manner that is responsive to each child’s particular age, capacity, needs and maturity.' }
    ]
  },
  {
    id: '3',
    name: 'Baker v. Canada (Minister of Citizenship and Immigration)',
    citation: '[1999] 2 SCR 817',
    year: 1999,
    court: 'SCC',
    tags: ['Procedural Fairness', 'Baker', 'H&C'],
    summary: 'Established the duty of procedural fairness in administrative law and the "Baker factors".',
    paragraphs: [
      { id: '3-21', number: 21, text: 'The concept of procedural fairness is eminently variable and its content is to be decided in the specific context of each case.' },
      { id: '3-43', number: 43, text: 'Procedural fairness also requires that decisions be made free from a reasonable apprehension of bias by an impartial decision-maker.' }
    ]
  },
  {
    id: '4',
    name: 'Irimie v. Canada (Citizenship and Immigration)',
    citation: '2000 CanLII 16688',
    year: 2000,
    court: 'FC',
    tags: ['Study Permit', 'Dual Intent', '216(1)'],
    summary: 'Discusses the assessment of bona fides in study permit applications.',
    paragraphs: [
      { id: '4-12', number: 12, text: 'The officer must assess whether the applicant is a bona fide student who will leave Canada by the end of the period authorized for their stay.' }
    ]
  },
  {
    id: '5',
    name: 'Tran v. Canada (Public Safety and Emergency Preparedness)',
    citation: '2017 SCC 50',
    year: 2017,
    court: 'SCC',
    tags: ['Serious Criminality', 'Misrepresentation', 'Inadmissibility'],
    summary: 'Interpretation of "serious criminality" under s. 36(1)(a) of IRPA.',
    paragraphs: [
      { id: '5-20', number: 20, text: 'The term "term of imprisonment" in s. 36(1)(a) refers to the sentence actually imposed, not the maximum potential sentence.' }
    ]
  },
  {
    id: '6',
    name: 'Patel v. Canada (Citizenship and Immigration)',
    citation: '2020 FC 77',
    year: 2020,
    court: 'FC',
    tags: ['TRV', '179(b)', 'Ties to Home'],
    summary: 'Common reasoning flaws in TRV refusals regarding ties to home country.',
    paragraphs: [
      { id: '6-14', number: 14, text: 'It is unreasonable for an officer to find that strong family ties in Canada negatively affect an application without weighing the ties to the home country.' }
    ]
  },
  {
    id: '7',
    name: 'Dunsmuir v. New Brunswick',
    citation: '2008 SCC 9',
    year: 2008,
    court: 'SCC',
    tags: ['Standard of Review', 'Historic'],
    summary: 'Previous leading case on standard of review, largely overtaken by Vavilov but historically significant.',
    paragraphs: [
      { id: '7-47', number: 47, text: 'Reasonableness is a deferential standard animated by the principle that underlies all administrative law: judicial respect for the democratic mandates of decision-makers.' }
    ]
  },
  {
    id: '8',
    name: 'Momi v. Canada (Citizenship and Immigration)',
    citation: '2013 FC 666',
    year: 2013,
    court: 'FC',
    tags: ['Study Permit', 'Financials'],
    summary: 'Review of financial sufficiency for study permits.',
    paragraphs: [
      { id: '8-9', number: 9, text: 'An officer cannot simply state that funds are insufficient without explaining why the evidence provided was rejected.' }
    ]
  },
  {
    id: '9',
    name: 'Yuzer v. Canada (Citizenship and Immigration)',
    citation: '2019 FC 767',
    year: 2019,
    court: 'FC',
    tags: ['Work Permit', 'Self-Employment'],
    summary: 'Significant benefit to Canada in self-employed work permit cases.',
    paragraphs: [
      { id: '9-18', number: 18, text: 'The officer failed to engage with the business plan provided by the applicant, rendering the decision unreasonable.' }
    ]
  },
  {
    id: '10',
    name: 'ABC v. Canada (Citizenship and Immigration)',
    citation: '2021 FC 123',
    year: 2021,
    court: 'FC',
    tags: ['Refugee', 'Credibility'],
    summary: 'Credibility assessments in refugee claims.',
    paragraphs: [
      { id: '10-34', number: 34, text: 'Credibility findings must be clear and unmistakable. Minor inconsistencies should not be the basis for a general finding of lack of credibility.' }
    ]
  },
  {
    id: '11',
    name: 'Gigi v. Canada (Citizenship and Immigration)',
    citation: '2022 FC 456',
    year: 2022,
    court: 'FC',
    tags: ['Misrepresentation', 'Innocent Mistake'],
    summary: 'The scope of the "innocent mistake" exception in misrepresentation.',
    paragraphs: [
      { id: '11-12', number: 12, text: 'While the exception for innocent mistakes is narrow, it exists where the applicant honestly and reasonably believed they were not misrepresenting a material fact.' }
    ]
  },
  {
    id: '12',
    name: 'Smith v. Canada (Minister of Citizenship and Immigration)',
    citation: '2023 FC 89',
    year: 2023,
    court: 'FC',
    tags: ['Procedural Fairness', 'Right to Respond'],
    summary: 'Duty to provide an applicant with an opportunity to respond to extrinsic evidence.',
    paragraphs: [
      { id: '12-22', number: 22, text: 'Where an officer relies on extrinsic evidence not known to the applicant, procedural fairness demands that the applicant be given a meaningful opportunity to respond.' }
    ]
  }
];