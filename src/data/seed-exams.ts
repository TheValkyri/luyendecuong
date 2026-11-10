import exampleExamJson from '../../data/example-exam.json';
import congNgheTongHopJson from '../../data/cong-nghe-11-tong-hop.json';
import cn11Bai1Json from '../../data/cn11_bai_1.json';
import cn11Bai2Json from '../../data/cn11_bai_2.json';
import cn11Bai3Json from '../../data/cn11_bai_3.json';
import cn11Bai4Json from '../../data/cn11_bai_4.json';
import cn11Bai5Json from '../../data/cn11_bai_5.json';
import cn11Bai6Json from '../../data/cn11_bai_6.json';
import { ExamContract } from '../types/exam';

export const INITIAL_PUBLISHED_EXAM: ExamContract = exampleExamJson as unknown as ExamContract;
export const CONG_NGHE_11_TONG_HOP_EXAM: ExamContract = congNgheTongHopJson as unknown as ExamContract;

export const CONG_NGHE_11_LESSON_EXAMS: ExamContract[] = [
  congNgheTongHopJson as unknown as ExamContract,
  cn11Bai1Json as unknown as ExamContract,
  cn11Bai2Json as unknown as ExamContract,
  cn11Bai3Json as unknown as ExamContract,
  cn11Bai4Json as unknown as ExamContract,
  cn11Bai5Json as unknown as ExamContract,
  cn11Bai6Json as unknown as ExamContract,
];
