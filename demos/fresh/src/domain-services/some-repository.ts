import { SomeDomainEntity } from "../domain-model/some-domain-entity";

export interface SomeRepository {
    getSomeData(): Promise<SomeDomainEntity>;
}
