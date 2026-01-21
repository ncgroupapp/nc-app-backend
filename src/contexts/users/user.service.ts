import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async findOneByEmail(email: string): Promise<User | null> {
    console.log(`Searching for user with email: ${email}`);
    const user = await this.userRepository.findOne({ 
      where: { email },
      select: ['id', 'email', 'password', 'createdAt', 'updatedAt'] 
    });
    console.log(`User search result: ${user ? 'Found' : 'Not Found'}`);
    return user;
  }

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: refreshToken || undefined });
  }

  async getUserIfRefreshTokenMatches(refreshToken: string, userId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'refreshToken', 'email'],
    });

    const isRefreshTokenMatching = user?.refreshToken === refreshToken;

    if (isRefreshTokenMatching) {
      return user;
    }
    
    return null;
  }

  async getRefreshToken(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['refreshToken'],
    });
    return user?.refreshToken || '';
  }
}
