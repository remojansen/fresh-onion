import { SomeRepository } from "../domain-services/some-repository";

export class SomeAppService {
  constructor(private readonly someRepository: SomeRepository) {}

  async getSomeData() {
    return this.someRepository.getSomeData();
  }
}
